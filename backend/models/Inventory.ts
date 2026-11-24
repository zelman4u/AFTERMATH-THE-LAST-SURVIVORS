import type { InventoryItem } from '../../src/game/types';

export interface InventoryDocument {
  _id: string;
  ownerId: string;
  saveId: string;
  items: InventoryItem[];
  equippedWeaponId: string;
  equippedMeleeId: string;
  equippedArmorId: string | null;
  equippedBackpackId: string;
  totalWeightKg: number;
  maxWeightKg: number;
  updatedAtIso: string;
}

export const InventoryCollectionSchema = {
  collection: 'inventories',
  indexes: ['ownerId', 'saveId'],
  requiredFields: ['ownerId', 'saveId', 'items'],
} as const;
