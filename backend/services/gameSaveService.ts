import crypto from 'crypto';
import { database, type SaveBackupEntry } from '../config/database';
import { getZoneAtPosition } from '../../src/game/simulation';
import type { GameSaveRecord } from '../../src/game/types';
import { validateAndSanitizeInventory } from './inventoryService';
import { updatePlayerProgression } from './progressionService';

const MAX_BACKUPS_PER_SLOT = 10;

function makeKey(ownerId: string, saveId: string): string {
  return `${ownerId}::${saveId}`;
}

function computeChecksum(record: GameSaveRecord): string {
  const raw = JSON.stringify({
    characterId: record.characterId,
    day: record.day,
    inventory: record.payload.inventory,
    zombieKills: record.payload.zombieKills,
    structures: record.payload.structures.length,
  });
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

export interface SaveUpsertResult {
  ok: boolean;
  error?: string;
  save?: GameSaveRecord;
  checksum?: string;
  backupsCount?: number;
}

export function upsertSaveSlot(params: {
  ownerId: string;
  saveId: string;
  incoming: GameSaveRecord;
  reason?: 'auto' | 'manual' | 'sync';
  syncSource?: 'web' | 'unity' | 'unreal' | 'offline-reconciled';
}): SaveUpsertResult {
  const { ownerId, saveId, incoming, reason = 'manual', syncSource = 'web' } = params;
  if (!incoming || !incoming.payload || !incoming.characterId) {
    return { ok: false, error: 'Missing save payload or characterId.' };
  }

  const invCheck = validateAndSanitizeInventory(
    incoming.payload.inventory,
    incoming.payload.equippedBackpackId,
  );
  if (!invCheck.valid) {
    database.appendAuditLog({
      ownerId,
      action: `SAVE_REJECTED_${saveId}`,
      status: 'rejected',
      detail: invCheck.reason || 'Inventory validation failed.',
    });
    return { ok: false, error: invCheck.reason || 'Inventory validation failed.' };
  }

  const store = database.getStore();
  const key = makeKey(ownerId, saveId);
  const existing = store.gamesaves[key] as unknown as (GameSaveRecord & { checksum?: string }) | undefined;

  // Reject impossible day regression on automatic sync unless explicit manual overwrite or higher version
  if (
    reason === 'sync' &&
    existing &&
    incoming.day < existing.day &&
    incoming.version <= existing.version
  ) {
    return {
      ok: true,
      save: existing,
      checksum: existing.checksum,
      backupsCount: (store.savebackups[key] || []).length,
    };
  }

  const nextVersion = Math.max(incoming.version || 1, (existing?.version || 0) + 1);
  const sanitizedSave: GameSaveRecord = {
    ...incoming,
    saveId,
    ownerId,
    version: nextVersion,
    day: Math.max(1, Math.min(9999, Math.round(incoming.day || 1))),
    timeOfDay: Math.max(0, Math.min(24, Number((incoming.timeOfDay ?? 8).toFixed(2)))),
    payload: {
      ...incoming.payload,
      inventory: invCheck.sanitizedInventory,
      stats: {
        ...incoming.payload.stats,
        health: Math.max(0, Math.min(250, incoming.payload.stats.health)),
        hunger: Math.max(0, Math.min(100, incoming.payload.stats.hunger)),
        thirst: Math.max(0, Math.min(100, incoming.payload.stats.thirst)),
      },
    },
    updatedAtIso: new Date().toISOString(),
  };

  const checksum = computeChecksum(sanitizedSave);

  // Store previous version in backup history before overwriting
  const backups = store.savebackups[key] || [];
  if (existing) {
    const zone = getZoneAtPosition(existing.payload.position.x, existing.payload.position.z);
    backups.unshift({
      backupId: `bkp_${Date.now()}_${existing.version}`,
      saveId,
      ownerId,
      version: existing.version,
      day: existing.day,
      characterId: existing.characterId,
      zoneId: zone.id,
      reason,
      createdAtIso: new Date().toISOString(),
      snapshot: existing as unknown as Record<string, unknown>,
    });
    if (backups.length > MAX_BACKUPS_PER_SLOT) {
      backups.length = MAX_BACKUPS_PER_SLOT;
    }
    store.savebackups[key] = backups;
  }

  store.gamesaves[key] = {
    ...sanitizedSave,
    _id: key,
    checksum,
    syncSource,
  } as unknown as Record<string, unknown>;

  store.inventories[key] = {
    _id: key,
    ownerId,
    saveId,
    items: invCheck.sanitizedInventory,
    totalWeightKg: invCheck.totalWeightKg,
    updatedAtIso: sanitizedSave.updatedAtIso,
  };

  store.worlds[key] = {
    _id: key,
    ownerId,
    saveId,
    day: sanitizedSave.day,
    timeOfDay: sanitizedSave.timeOfDay,
    weather: sanitizedSave.weather,
    discoveredZoneIds: sanitizedSave.payload.discoveredZoneIds,
    defeatedBossIds: sanitizedSave.payload.defeatedBossIds,
    recruitedIds: sanitizedSave.payload.recruitedIds,
    updatedAtIso: sanitizedSave.updatedAtIso,
  };

  store.bases[key] = {
    _id: key,
    ownerId,
    saveId,
    structures: sanitizedSave.payload.structures,
    updatedAtIso: sanitizedSave.updatedAtIso,
  };

  updatePlayerProgression(ownerId, sanitizedSave);
  database.appendAuditLog({
    ownerId,
    action: `SAVE_${reason.toUpperCase()}_${saveId}`,
    status: 'accepted',
    detail: `Day ${sanitizedSave.day} (${syncSource}), v${sanitizedSave.version}`,
  });

  return {
    ok: true,
    save: sanitizedSave,
    checksum,
    backupsCount: backups.length,
  };
}

export function listPlayerSaveSlots(ownerId: string): {
  slots: (GameSaveRecord & { backupsCount: number })[];
} {
  const store = database.getStore();
  const slots: (GameSaveRecord & { backupsCount: number })[] = [];
  for (const [key, val] of Object.entries(store.gamesaves)) {
    if (key.startsWith(`${ownerId}::`)) {
      const save = val as unknown as GameSaveRecord;
      const backups = store.savebackups[key] || [];
      slots.push({ ...save, backupsCount: backups.length });
    }
  }
  slots.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
  return { slots };
}

export function getSaveBackups(ownerId: string, saveId: string): SaveBackupEntry[] {
  const store = database.getStore();
  return store.savebackups[makeKey(ownerId, saveId)] || [];
}

export function restoreSaveFromBackup(
  ownerId: string,
  saveId: string,
  backupId: string,
): SaveUpsertResult {
  const store = database.getStore();
  const key = makeKey(ownerId, saveId);
  const backups = store.savebackups[key] || [];
  const target = backups.find((b) => b.backupId === backupId);
  if (!target) {
    return { ok: false, error: 'Backup snapshot not found.' };
  }
  const existing = store.gamesaves[key] as unknown as GameSaveRecord | undefined;
  const restoredRecord: GameSaveRecord = {
    ...(target.snapshot as unknown as GameSaveRecord),
    version: Math.max((existing?.version ?? 0) + 1, 1),
  };
  return upsertSaveSlot({
    ownerId,
    saveId,
    incoming: restoredRecord,
    reason: 'manual',
    syncSource: 'web',
  });
}

export function deleteSaveSlot(ownerId: string, saveId: string): boolean {
  const store = database.getStore();
  const key = makeKey(ownerId, saveId);
  if (!store.gamesaves[key]) return false;
  delete store.gamesaves[key];
  delete store.inventories[key];
  delete store.worlds[key];
  delete store.bases[key];
  delete store.savebackups[key];
  database.persist();
  return true;
}
