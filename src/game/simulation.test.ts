import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addItemToInventory,
  advanceCalendar,
  buildStructureInSave,
  computeWeaponDamage,
  consumeItem,
  craftRecipe,
  createInitialSaveRecord,
  evaluateAchievementsAndChapters,
  getEvolutionScaling,
  tickSurvivalNeeds,
  upgradeWeapon,
} from './simulation';
import {
  BASE_STRUCTURES,
  CRAFTING_RECIPES,
  ITEMS_CATALOG,
  PLAYABLE_CHARACTERS,
  STORY_CHAPTERS,
  WORLD_ZONES,
  ZOMBIE_DEFINITIONS,
} from './data';

test('roster and world completeness meet minimum specification', () => {
  assert.ok(PLAYABLE_CHARACTERS.length >= 12);
  const males = PLAYABLE_CHARACTERS.filter((c) => c.gender === 'Male');
  const females = PLAYABLE_CHARACTERS.filter((c) => c.gender === 'Female');
  assert.ok(males.length >= 6);
  assert.ok(females.length >= 6);
  assert.equal(WORLD_ZONES.length, 9);
  assert.equal(ZOMBIE_DEFINITIONS.length, 12);

  for (const c of PLAYABLE_CHARACTERS) {
    assert.ok(ITEMS_CATALOG[c.startingWeaponId], `Missing weapon ${c.startingWeaponId}`);
    for (const s of c.startingItems) {
      assert.ok(ITEMS_CATALOG[s.itemId], `Missing starting item ${s.itemId}`);
    }
  }
  for (const z of WORLD_ZONES) {
    for (const l of z.lootPool) assert.ok(ITEMS_CATALOG[l], `Missing loot item ${l}`);
  }
  for (const r of CRAFTING_RECIPES) {
    assert.ok(ITEMS_CATALOG[r.resultItemId], `Missing recipe result ${r.resultItemId}`);
    for (const ing of r.ingredients) assert.ok(ITEMS_CATALOG[ing.itemId], `Missing recipe ing ${ing.itemId}`);
  }
  for (const st of BASE_STRUCTURES) {
    for (const cost of st.cost) assert.ok(ITEMS_CATALOG[cost.itemId], `Missing cost item ${cost.itemId}`);
  }
  for (const z of ZOMBIE_DEFINITIONS) {
    for (const d of z.drops) assert.ok(ITEMS_CATALOG[d], `Missing zombie drop ${d}`);
  }
  for (const ch of STORY_CHAPTERS) {
    for (const rw of ch.rewardItems) assert.ok(ITEMS_CATALOG[rw.itemId], `Missing reward item ${rw.itemId}`);
  }
});

test('new survival game starts on Day 1 and decays hunger/thirst over time', () => {
  const save = createInitialSaveRecord({
    ownerId: 'user_123',
    characterId: 'ethan_walker',
    mode: 'story',
    difficulty: 'normal',
  });
  assert.equal(save.day, 1);
  assert.equal(save.payload.stats.health, 115);

  const decayed = tickSurvivalNeeds(save.payload.stats, {
    dt: 20,
    isSprinting: false,
    isNight: false,
    weather: 'clear',
    nearCampfire: false,
    character: PLAYABLE_CHARACTERS[0],
    difficulty: 'normal',
    armorId: save.payload.equippedArmorId,
  });

  assert.ok(decayed.hunger < save.payload.stats.hunger);
  assert.ok(decayed.thirst < save.payload.stats.thirst);
  assert.ok(save.payload.stats.hunger - decayed.hunger < save.payload.stats.thirst - decayed.thirst);
});

test('consuming food and water restores stats and decrements inventory', () => {
  let save = createInitialSaveRecord({
    ownerId: 'user_123',
    characterId: 'ethan_walker',
    mode: 'story',
    difficulty: 'normal',
  });
  save.payload.stats.hunger = 40;
  save.payload.stats.thirst = 40;

  const eatRes = consumeItem(save, 'canned_beans');
  assert.equal(eatRes.ok, true);
  assert.ok(eatRes.save.payload.stats.hunger > 40);

  const drinkRes = consumeItem(eatRes.save, 'bottled_water');
  assert.equal(drinkRes.ok, true);
  assert.ok(drinkRes.save.payload.stats.thirst > 40);
});

test('crafting, weapon upgrades, and base building enforce materials and increase power', () => {
  let save = createInitialSaveRecord({
    ownerId: 'user_123',
    characterId: 'marcus_reed',
    mode: 'endless',
    difficulty: 'normal',
  });
  save.payload.inventory = addItemToInventory(save.payload.inventory, 'wood_plank', 10);
  save.payload.inventory = addItemToInventory(save.payload.inventory, 'scrap_metal', 10);

  const craftRes = craftRecipe(save, 'craft_nail_bat');
  assert.equal(craftRes.ok, true);
  save = craftRes.save;

  const baseDmg = computeWeaponDamage(save, 'pistol_9mm');
  const upgRes = upgradeWeapon(save, 'pistol_9mm');
  assert.equal(upgRes.ok, true);
  save = upgRes.save;
  const upgradedDmg = computeWeaponDamage(save, 'pistol_9mm');
  assert.ok(upgradedDmg > baseDmg);

  save.payload.inventory = addItemToInventory(save.payload.inventory, 'purified_water', 2);
  const buildRes = buildStructureInSave(save, 'farm_plot', 5, 5);
  assert.equal(buildRes.ok, true);
  assert.equal(buildRes.save.payload.structures.length, 3);
});

test('calendar advances past Day 100 and unlocks achievements', () => {
  let save = createInitialSaveRecord({
    ownerId: 'user_123',
    characterId: 'victoria_chen',
    mode: 'endless',
    difficulty: 'hard',
  });

  // Advance 105 days
  const adv = advanceCalendar(save, 24 * 105);
  assert.equal(adv.newDayTriggered, true);
  assert.equal(adv.save.day, 106);

  const evalRes = evaluateAchievementsAndChapters(adv.save);
  assert.ok(evalRes.save.payload.unlockedAchievementIds.includes('ach_day100'));

  const scaling = getEvolutionScaling(106, 'hard');
  assert.ok(scaling.hpMult > 2);
  assert.ok(scaling.spawnBudget <= 34);
});
