import { database } from '../config/database';
import type { GameSaveRecord } from '../../src/game/types';
import type { PlayerDocument } from '../models/Player';

export function updatePlayerProgression(ownerId: string, save: GameSaveRecord): PlayerDocument {
  const store = database.getStore();
  const prev = store.players[ownerId] as unknown as PlayerDocument | undefined;

  const achievementSet = new Set<string>([
    ...(prev?.unlockedAchievements || []),
    ...(save.payload.unlockedAchievementIds || []),
  ]);

  const doc: PlayerDocument = {
    _id: ownerId,
    uid: ownerId,
    activeCharacterId: save.characterId,
    highestDay: Math.max(prev?.highestDay ?? 1, save.day),
    totalZombieKills: Math.max(prev?.totalZombieKills ?? 0, save.payload.zombieKills),
    totalScore: Math.max(prev?.totalScore ?? 0, save.payload.score),
    unlockedAchievements: [...achievementSet],
    updatedAtIso: new Date().toISOString(),
  };

  store.players[ownerId] = doc as unknown as Record<string, unknown>;
  store.achievements[ownerId] = doc.unlockedAchievements;
  database.persist();
  return doc;
}
