import type { Request, Response } from 'express';
import { ITEMS_CATALOG } from '../../src/game/data';
import { validateAndSanitizeInventory } from '../services/inventoryService';

export function validateInventoryEndpoint(req: Request, res: Response) {
  const { items, equippedBackpackId } = req.body as {
    items?: unknown;
    equippedBackpackId?: string;
  };
  const backpackId =
    typeof equippedBackpackId === 'string' && ITEMS_CATALOG[equippedBackpackId]
      ? equippedBackpackId
      : 'small_backpack';
  const result = validateAndSanitizeInventory(items, backpackId);
  if (!result.valid) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
}
