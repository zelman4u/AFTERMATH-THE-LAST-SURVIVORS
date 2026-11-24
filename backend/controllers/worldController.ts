import type { Request, Response } from 'express';
import {
  ACHIEVEMENTS_LIST,
  BASE_STRUCTURES,
  CRAFTING_RECIPES,
  ITEMS_CATALOG,
  RECRUITABLE_SURVIVORS,
  STORY_CHAPTERS,
  WORLD_ZONES,
  ZOMBIE_DEFINITIONS,
} from '../../src/game/data';

export function getWorldConfiguration(_req: Request, res: Response) {
  res.json({
    zones: WORLD_ZONES,
    zombies: ZOMBIE_DEFINITIONS,
    items: Object.values(ITEMS_CATALOG),
    recipes: CRAFTING_RECIPES,
    structures: BASE_STRUCTURES,
    npcs: RECRUITABLE_SURVIVORS,
    quests: STORY_CHAPTERS,
    achievements: ACHIEVEMENTS_LIST,
  });
}
