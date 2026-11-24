import { ITEMS_CATALOG } from '../../src/game/data';
import type { InventoryItem } from '../../src/game/types';

export interface InventoryValidationResult {
  valid: boolean;
  reason?: string;
  sanitizedInventory: InventoryItem[];
  totalWeightKg: number;
}

const MAX_STACK_QTY = 999;

/**
 * Server-side anti-duplication & item schema enforcement.
 * Rejects unknown items, negative quantities, unrealistic stack overflows,
 * and collapses duplicate stackable rows.
 */
export function validateAndSanitizeInventory(
  items: unknown,
  equippedBackpackId: string,
): InventoryValidationResult {
  if (!Array.isArray(items)) {
    return {
      valid: false,
      reason: 'Inventory must be an array.',
      sanitizedInventory: [],
      totalWeightKg: 0,
    };
  }

  const maxCarryWeight = (ITEMS_CATALOG[equippedBackpackId]?.backpackBonusKg ?? 25) + 40;
  const stackMap = new Map<string, InventoryItem>();
  const nonStackables: InventoryItem[] = [];
  let nonStackableCount = 0;

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') {
      return { valid: false, reason: 'Malformed inventory entry.', sanitizedInventory: [], totalWeightKg: 0 };
    }
    const entry = raw as Partial<InventoryItem>;
    if (typeof entry.itemId !== 'string' || !ITEMS_CATALOG[entry.itemId]) {
      return {
        valid: false,
        reason: `Unknown itemId: ${String(entry.itemId)}`,
        sanitizedInventory: [],
        totalWeightKg: 0,
      };
    }
    const def = ITEMS_CATALOG[entry.itemId];
    const qty = Math.floor(Number(entry.qty));
    if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_STACK_QTY) {
      return {
        valid: false,
        reason: `Invalid quantity (${entry.qty}) for ${entry.itemId}.`,
        sanitizedInventory: [],
        totalWeightKg: 0,
      };
    }

    if (def.stackable) {
      const prev = stackMap.get(entry.itemId);
      const nextQty = (prev?.qty ?? 0) + qty;
      if (nextQty > MAX_STACK_QTY) {
        return {
          valid: false,
          reason: `Stack limit exceeded for ${def.name} (suspected duplication).`,
          sanitizedInventory: [],
          totalWeightKg: 0,
        };
      }
      stackMap.set(entry.itemId, { itemId: entry.itemId, qty: nextQty });
    } else {
      nonStackableCount += qty;
      if (nonStackableCount > 60) {
        return {
          valid: false,
          reason: 'Maximum non-stackable gear capacity exceeded.',
          sanitizedInventory: [],
          totalWeightKg: 0,
        };
      }
      const upgradeLevel = Math.max(1, Math.min(5, Math.round(Number(entry.upgradeLevel ?? 1))));
      const durability = Math.max(0, Math.min(100, Math.round(Number(entry.durability ?? 100))));
      nonStackables.push({
        itemId: entry.itemId,
        qty: 1,
        upgradeLevel,
        durability,
      });
    }
  }

  const sanitizedInventory = [...nonStackables, ...stackMap.values()];
  let totalWeightKg = 0;
  for (const item of sanitizedInventory) {
    const def = ITEMS_CATALOG[item.itemId];
    if (def) totalWeightKg += def.weight * item.qty;
  }
  totalWeightKg = Math.round(totalWeightKg * 10) / 10;

  if (totalWeightKg > maxCarryWeight) {
    return {
      valid: false,
      reason: `Inventory weight ${totalWeightKg}kg exceeds physical limit (${maxCarryWeight}kg).`,
      sanitizedInventory: [],
      totalWeightKg,
    };
  }

  return { valid: true, sanitizedInventory, totalWeightKg };
}
