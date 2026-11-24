import { auth } from '../firebase';
import type { GameSaveRecord } from '../game/types';

export type SaveSlotId = 'active' | 'slot_1' | 'slot_2' | 'slot_3';

export interface SaveSlotSummary extends GameSaveRecord {
  backupsCount: number;
}

export interface SaveBackupSnapshot {
  backupId: string;
  saveId: string;
  ownerId: string;
  version: number;
  day: number;
  characterId: string;
  zoneId: string;
  reason: 'auto' | 'manual' | 'sync';
  createdAtIso: string;
}

export interface PlayerProfileSummary {
  _id: string;
  uid: string;
  activeCharacterId: string;
  highestDay: number;
  totalZombieKills: number;
  totalScore: number;
  unlockedAchievements: string[];
  updatedAtIso: string;
}

export interface AdminOverviewResponse {
  databaseMode: string;
  collections: string[];
  autoSaveIntervalSec: number;
  counts: {
    users: number;
    players: number;
    saves: number;
    backups: number;
  };
  users: Record<string, unknown>[];
  players: Record<string, unknown>[];
  auditLogs: {
    id: string;
    ownerId: string;
    action: string;
    status: 'accepted' | 'rejected';
    detail: string;
    timestampIso: string;
  }[];
}

const GUEST_ID_KEY = 'aftermath_guest_id_v1';
const OFFLINE_QUEUE_KEY = 'aftermath_offline_sync_queue_v1';

export function getPersistentGuestId(): string {
  try {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing && /^guest_[a-zA-Z0-9_-]{6,32}$/.test(existing)) {
      return existing;
    }
    const generated = `guest_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    localStorage.setItem(GUEST_ID_KEY, generated);
    return generated;
  } catch {
    return 'guest_local';
  }
}

async function buildHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-guest-id': getPersistentGuestId(),
  };
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Fallback to guest header if token refresh fails
    }
  }
  return headers;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = await buildHeaders();
  const resp = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
  });
  const data = (await resp.json().catch(() => ({}))) as T & { error?: string };
  if (!resp.ok) {
    throw new Error(data.error || `API request failed (${resp.status})`);
  }
  return data;
}

export async function fetchAuthStatus(): Promise<{
  authenticated: boolean;
  isAdmin: boolean;
  user: { uid: string; email: string; name: string } | null;
}> {
  return apiFetch('/api/auth/status');
}

export async function syncAuthSession(): Promise<{ isAdmin: boolean }> {
  return apiFetch('/api/auth/session', { method: 'POST', body: '{}' });
}

export async function fetchPlayerProfile(): Promise<{ player: PlayerProfileSummary }> {
  return apiFetch('/api/players/profile');
}

export async function fetchSaveSlots(): Promise<{
  ownerId: string;
  slots: SaveSlotSummary[];
}> {
  return apiFetch('/api/saves');
}

export async function putSaveSlot(
  slotId: SaveSlotId,
  save: GameSaveRecord,
  reason: 'auto' | 'manual' | 'sync' = 'manual',
): Promise<{
  ok: boolean;
  save?: GameSaveRecord;
  checksum?: string;
  backupsCount?: number;
}> {
  return apiFetch(`/api/saves/${slotId}`, {
    method: 'PUT',
    body: JSON.stringify({ save, reason, syncSource: 'web' }),
  });
}

export async function fetchSlotBackups(slotId: SaveSlotId): Promise<{
  backups: SaveBackupSnapshot[];
}> {
  return apiFetch(`/api/saves/${slotId}/backups`);
}

export async function restoreSlotBackup(
  slotId: SaveSlotId,
  backupId: string,
): Promise<{ ok: boolean; save?: GameSaveRecord }> {
  return apiFetch(`/api/saves/${slotId}/restore/${encodeURIComponent(backupId)}`, {
    method: 'POST',
    body: '{}',
  });
}

export async function deleteSaveSlotApi(slotId: SaveSlotId): Promise<{ deleted: boolean }> {
  return apiFetch(`/api/saves/${slotId}`, { method: 'DELETE' });
}

export async function fetchAdminOverview(): Promise<AdminOverviewResponse> {
  return apiFetch('/api/admin/overview');
}

export async function fetchWorldHealth(): Promise<{
  ok: boolean;
  databaseMode: string;
  collections: number;
  totalSaves: number;
}> {
  return apiFetch('/api/health');
}

export function queueOfflineSave(slotId: SaveSlotId, save: GameSaveRecord): void {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = raw ? (JSON.parse(raw) as Record<string, GameSaveRecord>) : {};
    queue[slotId] = save;
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage errors
  }
}

export async function flushOfflineSaveQueue(): Promise<number> {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return 0;
    const queue = JSON.parse(raw) as Record<string, GameSaveRecord>;
    const entries = Object.entries(queue) as [SaveSlotId, GameSaveRecord][];
    if (entries.length === 0) return 0;
    let flushed = 0;
    const remaining: Record<string, GameSaveRecord> = {};
    for (const [slotId, save] of entries) {
      try {
        await putSaveSlot(slotId, save, 'sync');
        flushed += 1;
      } catch {
        remaining[slotId] = save;
      }
    }
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    return flushed;
  } catch {
    return 0;
  }
}
