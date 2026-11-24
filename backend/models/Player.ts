export interface PlayerDocument {
  _id: string;
  uid: string;
  activeCharacterId: string;
  highestDay: number;
  totalZombieKills: number;
  totalScore: number;
  unlockedAchievements: string[];
  updatedAtIso: string;
}

export const PlayerCollectionSchema = {
  collection: 'players',
  indexes: ['uid', 'highestDay'],
  requiredFields: ['uid', 'activeCharacterId'],
} as const;
