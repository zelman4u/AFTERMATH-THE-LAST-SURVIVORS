import type { Request, Response } from 'express';
import { isValidSaveSlotId, sanitizeGuestOwnerId } from '../middlewares/validationMiddleware';
import {
  deleteSaveSlot,
  getSaveBackups,
  listPlayerSaveSlots,
  restoreSaveFromBackup,
  upsertSaveSlot,
} from '../services/gameSaveService';
import type { GameSaveRecord } from '../../src/game/types';

function resolveOwnerId(req: Request): string {
  if (req.authUser?.uid) return req.authUser.uid;
  return sanitizeGuestOwnerId(req.headers['x-guest-id']);
}

export function getSavesHandler(req: Request, res: Response) {
  const ownerId = resolveOwnerId(req);
  const result = listPlayerSaveSlots(ownerId);
  res.json({ ownerId, ...result });
}

export function upsertSaveHandler(req: Request, res: Response) {
  const slotId = String(req.params.slotId || 'active');
  if (!isValidSaveSlotId(slotId)) {
    res.status(400).json({ error: 'Invalid save slot ID. Use active or slot_1..slot_3.' });
    return;
  }
  const ownerId = resolveOwnerId(req);
  const { save, reason, syncSource } = req.body as {
    save?: GameSaveRecord;
    reason?: 'auto' | 'manual' | 'sync';
    syncSource?: 'web' | 'unity' | 'unreal' | 'offline-reconciled';
  };
  if (!save) {
    res.status(400).json({ error: 'Missing save object in request body.' });
    return;
  }
  const result = upsertSaveSlot({
    ownerId,
    saveId: slotId,
    incoming: save,
    reason: reason || 'manual',
    syncSource: syncSource || 'web',
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
}

export function getBackupsHandler(req: Request, res: Response) {
  const slotId = String(req.params.slotId || 'active');
  if (!isValidSaveSlotId(slotId)) {
    res.status(400).json({ error: 'Invalid save slot ID.' });
    return;
  }
  const ownerId = resolveOwnerId(req);
  const backups = getSaveBackups(ownerId, slotId);
  res.json({ ownerId, saveId: slotId, backups });
}

export function restoreBackupHandler(req: Request, res: Response) {
  const slotId = String(req.params.slotId || 'active');
  const backupId = String(req.params.backupId || '');
  if (!isValidSaveSlotId(slotId) || !backupId) {
    res.status(400).json({ error: 'Invalid save slot or backup ID.' });
    return;
  }
  const ownerId = resolveOwnerId(req);
  const result = restoreSaveFromBackup(ownerId, slotId, backupId);
  if (!result.ok) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.json(result);
}

export function deleteSaveHandler(req: Request, res: Response) {
  const slotId = String(req.params.slotId || '');
  if (!isValidSaveSlotId(slotId)) {
    res.status(400).json({ error: 'Invalid save slot ID.' });
    return;
  }
  const ownerId = resolveOwnerId(req);
  const deleted = deleteSaveSlot(ownerId, slotId);
  res.json({ deleted });
}
