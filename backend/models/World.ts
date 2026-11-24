import { WORLD_ZONES, ZOMBIE_DEFINITIONS } from '../../src/game/data';
import type { PlacedStructure, WeatherType } from '../../src/game/types';

export interface WorldProgressDocument {
  _id: string;
  ownerId: string;
  saveId: string;
  day: number;
  timeOfDay: number;
  weather: WeatherType;
  discoveredZoneIds: string[];
  defeatedBossIds: string[];
  recruitedIds: string[];
  bases: PlacedStructure[];
  updatedAtIso: string;
}

export const WorldCollectionSchema = {
  collection: 'worlds',
  zones: WORLD_ZONES,
  zombies: ZOMBIE_DEFINITIONS.filter((z) => !z.isBoss),
  bosses: ZOMBIE_DEFINITIONS.filter((z) => z.isBoss),
};
