import type { Request, Response } from 'express';
import { COLLECTION_NAMES, database } from '../config/database';
import { ENV } from '../config/environment';
import { sanitizeGuestOwnerId } from '../middlewares/validationMiddleware';
import type { PlayerDocument } from '../models/Player';

export function getPlayerProfile(req: Request, res: Response) {
  const ownerId = req.authUser?.uid || sanitizeGuestOwnerId(req.headers['x-guest-id']);
  const store = database.getStore();
  const player = (store.players[ownerId] as unknown as PlayerDocument | undefined) || {
    _id: ownerId,
    uid: ownerId,
    activeCharacterId: 'ethan_walker',
    highestDay: 1,
    totalZombieKills: 0,
    totalScore: 0,
    unlockedAchievements: [],
    updatedAtIso: new Date().toISOString(),
  };
  res.json({ player });
}

export function getAdminOverview(_req: Request, res: Response) {
  const store = database.getStore();
  res.json({
    databaseMode: database.mode,
    collections: COLLECTION_NAMES,
    autoSaveIntervalSec: ENV.autoSaveIntervalSec,
    counts: {
      users: Object.keys(store.users).length,
      players: Object.keys(store.players).length,
      saves: Object.keys(store.gamesaves).length,
      backups: Object.values(store.savebackups).reduce((acc, arr) => acc + arr.length, 0),
    },
    users: Object.values(store.users),
    players: Object.values(store.players),
    auditLogs: store.auditLogs.slice(0, 30),
  });
}
