import type { GameSaveRecord } from '../../src/game/types';

export interface GameSaveDocument extends GameSaveRecord {
  _id: string;
  slotName: string;
  checksum: string;
  syncSource: 'web' | 'unity' | 'unreal' | 'offline-reconciled';
}

export const GameSaveCollectionSchema = {
  collection: 'gamesaves',
  indexes: ['ownerId', 'saveId', 'day'],
  maxSlotsPerPlayer: 3,
  maxBackupsPerSlot: 10,
} as const;
