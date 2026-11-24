import { CRAFTING_RECIPES, ITEMS_CATALOG } from '../../src/game/data';

export const WeaponCollectionSchema = {
  collection: 'weapons',
  source: Object.values(ITEMS_CATALOG).filter(
    (i) => i.category === 'firearm' || i.category === 'melee',
  ),
};

export const ArmorCollectionSchema = {
  collection: 'armor',
  source: Object.values(ITEMS_CATALOG).filter(
    (i) => i.category === 'armor' || i.category === 'backpack',
  ),
};

export const CraftingRecipeCollectionSchema = {
  collection: 'craftingrecipes',
  source: CRAFTING_RECIPES,
};
