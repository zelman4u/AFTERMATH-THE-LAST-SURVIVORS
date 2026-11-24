import {
  ACHIEVEMENTS_LIST,
  BASE_STRUCTURES,
  CRAFTING_RECIPES,
  ITEMS_CATALOG,
  PLAYABLE_CHARACTERS,
  STORY_CHAPTERS,
  WORLD_ZONES,
} from './data';
import type {
  CharacterProfile,
  DifficultyLevel,
  GameMode,
  GameSavePayload,
  GameSaveRecord,
  InventoryItem,
  PlayerStats,
  WeatherType,
  WorldZone,
} from './types';

export const SAVE_VERSION = 1;

export function getCharacterById(characterId: string): CharacterProfile {
  return PLAYABLE_CHARACTERS.find((c) => c.id === characterId) ?? PLAYABLE_CHARACTERS[0];
}

export function createInitialSaveRecord(params: {
  ownerId: string;
  characterId: string;
  mode: GameMode;
  difficulty: DifficultyLevel;
}): GameSaveRecord {
  const char = getCharacterById(params.characterId);
  const maxHealth = char.bonuses.maxHealth ?? 100;
  const maxStamina = char.bonuses.maxStamina ?? 100;

  const inventory: InventoryItem[] = char.startingItems.map((s) => ({
    itemId: s.itemId,
    qty: s.qty,
    upgradeLevel: 1,
    durability: 100,
  }));

  // Ensure everyone has a small backpack and melee fallback
  const hasArmor = inventory.find((i) => ITEMS_CATALOG[i.itemId]?.category === 'armor');
  const hasMelee = inventory.find((i) => ITEMS_CATALOG[i.itemId]?.category === 'melee');
  if (!hasMelee) {
    inventory.push({ itemId: 'kitchen_knife', qty: 1, upgradeLevel: 1, durability: 100 });
  }
  const hasBackpack = inventory.find((i) => ITEMS_CATALOG[i.itemId]?.category === 'backpack');
  const equippedBackpackId = hasBackpack ? hasBackpack.itemId : 'small_backpack';
  if (!hasBackpack) {
    inventory.push({ itemId: 'small_backpack', qty: 1 });
  }

  const equippedWeapon =
    ITEMS_CATALOG[char.startingWeaponId]?.category === 'firearm'
      ? char.startingWeaponId
      : inventory.find((i) => ITEMS_CATALOG[i.itemId]?.category === 'firearm')?.itemId ??
        char.startingWeaponId;

  const equippedMelee =
    ITEMS_CATALOG[char.startingWeaponId]?.category === 'melee'
      ? char.startingWeaponId
      : inventory.find((i) => ITEMS_CATALOG[i.itemId]?.category === 'melee')?.itemId ??
        'kitchen_knife';

  const ammoInMag: Record<string, number> = {};
  for (const inv of inventory) {
    const def = ITEMS_CATALOG[inv.itemId];
    if (def?.category === 'firearm' && def.magSize) {
      ammoInMag[inv.itemId] = def.magSize;
    }
  }

  const stats: PlayerStats = {
    health: maxHealth,
    maxHealth,
    hunger: 96,
    thirst: 95,
    stamina: maxStamina,
    maxStamina,
    energy: 98,
    temperature: 36.8,
    infection: 0,
    blood: 100,
    sanity: 95,
    bleeding: false,
    exhausted: false,
    hypothermia: false,
    level: 1,
    xp: 0,
    skillCombat: 1,
    skillMedical: 1,
    skillCrafting: 1,
    skillSurvival: 1,
  };

  const payload: GameSavePayload = {
    stats,
    position: { x: 0, z: 6 },
    inventory,
    equippedWeaponId: equippedWeapon,
    equippedMeleeId: equippedMelee,
    equippedArmorId: hasArmor ? hasArmor.itemId : null,
    equippedBackpackId,
    ammoInMag,
    structures: [
      { uid: 'init_wall_1', structureId: 'wood_wall', x: -12.5, z: -3.5, rotationY: Math.PI / 2, hp: 220, maxHp: 220 },
      { uid: 'init_wall_2', structureId: 'wood_wall', x: 8.5, z: -3.5, rotationY: Math.PI / 2, hp: 220, maxHp: 220 },
    ],
    recruitedIds: [],
    survivorTasks: {},
    survivorTrust: {},
    completedChapterIds: [],
    defeatedBossIds: [],
    unlockedAchievementIds: [],
    discoveredZoneIds: ['safehouse'],
    lootedContainerIds: [],
    zombieKills: 0,
    itemsCollected: 0,
    itemsCrafted: 0,
    injuriesTreated: 0,
    workbenchLevel: 1,
    inVehicle: false,
    vehicleFuel: 65,
    vehicleHealth: 100,
    score: 0,
  };

  return {
    saveId: 'active',
    ownerId: params.ownerId,
    version: SAVE_VERSION,
    characterId: char.id,
    mode: params.mode,
    difficulty: params.difficulty,
    day: 1,
    timeOfDay: 8.0,
    weather: 'clear',
    payload,
    updatedAtIso: new Date().toISOString(),
  };
}

export function getDifficultyMultipliers(difficulty: DifficultyLevel) {
  switch (difficulty) {
    case 'hard':
      return { drain: 1.25, zombieHp: 1.25, zombieDmg: 1.3, lootMult: 0.85 };
    case 'nightmare':
      return { drain: 1.5, zombieHp: 1.6, zombieDmg: 1.65, lootMult: 0.7 };
    default:
      return { drain: 1.0, zombieHp: 1.0, zombieDmg: 1.0, lootMult: 1.0 };
  }
}

export function getDayPhaseLabel(day: number): string {
  if (day <= 3) return 'Phase I · The Outbreak';
  if (day <= 7) return 'Phase II · First Shelter';
  if (day <= 15) return 'Phase III · Expansion';
  if (day <= 30) return 'Phase IV · Settlement';
  if (day <= 60) return 'Phase V · Mutation';
  if (day <= 100) return 'Phase VI · Dead Zones';
  if (day <= 200) return 'Phase VII · Human Conflicts';
  return 'Phase VIII · Endless Survival';
}

export function getEvolutionScaling(day: number, difficulty: DifficultyLevel) {
  const diff = getDifficultyMultipliers(difficulty);
  // Smooth, fair escalation that keeps Day 100+ intense without instant unfairness
  const dayFactor = 1 + Math.min(2.2, Math.log2(Math.max(1, day)) * 0.28);
  return {
    hpMult: dayFactor * diff.zombieHp,
    dmgMult: (1 + Math.min(1.4, (day - 1) * 0.015)) * diff.zombieDmg,
    spawnBudget: Math.min(34, 14 + Math.floor(day * 0.45)),
  };
}

export function getZoneAtPosition(x: number, z: number): WorldZone {
  let closest = WORLD_ZONES[0];
  let bestDist = Infinity;
  for (const zone of WORLD_ZONES) {
    const dx = x - zone.centerX;
    const dz = z - zone.centerZ;
    const dist = Math.hypot(dx, dz);
    if (dist <= zone.radius) return zone;
    if (dist < bestDist) {
      bestDist = dist;
      closest = zone;
    }
  }
  return closest;
}

export function computeInventoryWeight(inventory: InventoryItem[]): number {
  let total = 0;
  for (const item of inventory) {
    const def = ITEMS_CATALOG[item.itemId];
    if (def) {
      total += def.weight * item.qty;
    }
  }
  return Math.round(total * 10) / 10;
}

export function getMaxCarryWeight(equippedBackpackId: string): number {
  const def = ITEMS_CATALOG[equippedBackpackId];
  return def?.backpackBonusKg ?? 25;
}

export function getArmorDefense(equippedArmorId: string | null): number {
  if (!equippedArmorId) return 0;
  return ITEMS_CATALOG[equippedArmorId]?.armorDefense ?? 0;
}

export function addItemToInventory(
  inventory: InventoryItem[],
  itemId: string,
  qty: number,
): InventoryItem[] {
  const def = ITEMS_CATALOG[itemId];
  if (!def || qty <= 0) return inventory;
  const next = inventory.map((i) => ({ ...i }));
  if (def.stackable) {
    const existing = next.find((i) => i.itemId === itemId);
    if (existing) {
      existing.qty += qty;
      return next;
    }
  }
  for (let i = 0; i < (def.stackable ? 1 : qty); i++) {
    next.push({
      itemId,
      qty: def.stackable ? qty : 1,
      upgradeLevel: 1,
      durability: 100,
    });
  }
  return next;
}

export function removeItemFromInventory(
  inventory: InventoryItem[],
  itemId: string,
  qty: number,
): InventoryItem[] | null {
  let remaining = qty;
  const totalOwned = inventory
    .filter((i) => i.itemId === itemId)
    .reduce((acc, i) => acc + i.qty, 0);
  if (totalOwned < qty) return null;

  const next: InventoryItem[] = [];
  for (const item of inventory) {
    if (item.itemId !== itemId || remaining <= 0) {
      next.push({ ...item });
      continue;
    }
    if (item.qty > remaining) {
      next.push({ ...item, qty: item.qty - remaining });
      remaining = 0;
    } else {
      remaining -= item.qty;
    }
  }
  return next;
}

export function getItemCount(inventory: InventoryItem[], itemId: string): number {
  return inventory
    .filter((i) => i.itemId === itemId)
    .reduce((sum, item) => sum + item.qty, 0);
}

export function tickSurvivalNeeds(
  stats: PlayerStats,
  params: {
    dt: number;
    isSprinting: boolean;
    isNight: boolean;
    weather: WeatherType;
    nearCampfire: boolean;
    character: CharacterProfile;
    difficulty: DifficultyLevel;
    armorId: string | null;
  },
): PlayerStats {
  const { dt, isSprinting, isNight, weather, nearCampfire, character, difficulty, armorId } = params;
  const mult = getDifficultyMultipliers(difficulty).drain;
  const hungerMult = character.bonuses.hungerDrainMult ?? 1.0;

  const next = { ...stats };
  // Hunger & Thirst decay realistically over real-time play (thirst faster than hunger)
  next.hunger = Math.max(0, next.hunger - 0.14 * dt * mult * hungerMult);
  next.thirst = Math.max(0, next.thirst - 0.21 * dt * mult);
  next.energy = Math.max(0, next.energy - 0.08 * dt * mult);

  // Stamina
  if (isSprinting && next.stamina > 0) {
    next.stamina = Math.max(0, next.stamina - 18 * dt);
  } else {
    const regenRate = next.energy < 20 ? 7 : 14;
    next.stamina = Math.min(next.maxStamina, next.stamina + regenRate * dt);
  }

  // Body temperature affected by weather, night, armor insulation, and campfire warmth
  const insulation = armorId ? (ITEMS_CATALOG[armorId]?.coldInsulation ?? 0) * 0.05 : 0;
  let targetTemp = 36.8;
  if (isNight) targetTemp -= 1.2;
  if (weather === 'rain') targetTemp -= 1.1;
  if (weather === 'storm') targetTemp -= 1.8;
  if (weather === 'fog') targetTemp -= 0.5;
  targetTemp += insulation;
  if (nearCampfire) targetTemp = Math.max(targetTemp, 37.0);
  targetTemp = Math.min(37.4, Math.max(33.2, targetTemp));
  next.temperature = next.temperature + (targetTemp - next.temperature) * Math.min(1, dt * 0.25);

  next.exhausted = next.energy < 15;
  next.hypothermia = next.temperature < 35.0;

  // Condition penalties
  if (next.bleeding) {
    next.blood = Math.max(0, next.blood - 1.2 * dt);
    next.health = Math.max(0, next.health - 1.6 * dt);
  }
  if (next.hunger <= 0) {
    next.health = Math.max(0, next.health - 0.9 * dt);
  }
  if (next.thirst <= 0) {
    next.health = Math.max(0, next.health - 1.3 * dt);
  }
  if (next.hypothermia) {
    next.health = Math.max(0, next.health - 0.7 * dt);
  }
  if (next.infection >= 100) {
    next.health = Math.max(0, next.health - 2.5 * dt);
  } else if (next.infection > 40) {
    next.health = Math.max(0, next.health - 0.4 * dt);
  }
  if (isNight && !nearCampfire) {
    next.sanity = Math.max(0, next.sanity - 0.12 * dt);
  } else if (nearCampfire) {
    next.sanity = Math.min(100, next.sanity + 0.6 * dt);
  }

  return next;
}

export function consumeItem(
  save: GameSaveRecord,
  itemId: string,
): { ok: boolean; save: GameSaveRecord; message: string } {
  const def = ITEMS_CATALOG[itemId];
  if (!def) return { ok: false, save, message: 'Unknown item.' };
  const updatedInv = removeItemFromInventory(save.payload.inventory, itemId, 1);
  if (!updatedInv) return { ok: false, save, message: 'Item not in inventory.' };

  const char = getCharacterById(save.characterId);
  const healMult = char.bonuses.healMult ?? 1.0;
  const stats = { ...save.payload.stats };

  if (def.hungerRestore) stats.hunger = Math.min(100, stats.hunger + def.hungerRestore);
  if (def.thirstRestore) stats.thirst = Math.min(100, stats.thirst + def.thirstRestore);
  if (def.energyRestore) {
    stats.energy = Math.min(100, stats.energy + def.energyRestore);
    stats.stamina = Math.min(stats.maxStamina, stats.stamina + def.energyRestore);
  }
  if (def.healthRestore) {
    const delta = def.healthRestore > 0 ? def.healthRestore * healMult : def.healthRestore;
    stats.health = Math.max(0, Math.min(stats.maxHealth, stats.health + delta));
  }
  if (def.curesBleeding) {
    stats.bleeding = false;
    stats.blood = Math.min(100, stats.blood + 20);
  }
  if (def.infectionCure) {
    stats.infection = Math.max(0, stats.infection - def.infectionCure);
  }

  const injuriesTreated =
    save.payload.injuriesTreated + (def.category === 'medicine' ? 1 : 0);

  return {
    ok: true,
    save: {
      ...save,
      payload: {
        ...save.payload,
        stats,
        inventory: updatedInv,
        injuriesTreated,
      },
    },
    message: `Used ${def.name}.`,
  };
}

export function craftRecipe(
  save: GameSaveRecord,
  recipeId: string,
): { ok: boolean; save: GameSaveRecord; message: string } {
  const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, save, message: 'Recipe not found.' };
  if (save.payload.workbenchLevel < recipe.workbenchLevel) {
    return { ok: false, save, message: `Requires Workbench Level ${recipe.workbenchLevel}.` };
  }

  let inv = save.payload.inventory;
  for (const ing of recipe.ingredients) {
    const nextInv = removeItemFromInventory(inv, ing.itemId, ing.qty);
    if (!nextInv) {
      const missingName = ITEMS_CATALOG[ing.itemId]?.name ?? ing.itemId;
      return { ok: false, save, message: `Missing ${missingName} (need ${ing.qty}).` };
    }
    inv = nextInv;
  }

  const char = getCharacterById(save.characterId);
  const bonus =
    ITEMS_CATALOG[recipe.resultItemId]?.stackable && char.bonuses.craftYieldBonus
      ? char.bonuses.craftYieldBonus
      : 0;
  inv = addItemToInventory(inv, recipe.resultItemId, recipe.resultQty + bonus);

  const stats = { ...save.payload.stats };
  stats.xp += 25;
  stats.skillCrafting += 0.1;

  return {
    ok: true,
    save: {
      ...save,
      payload: {
        ...save.payload,
        stats,
        inventory: inv,
        itemsCrafted: save.payload.itemsCrafted + 1,
        score: save.payload.score + 30,
      },
    },
    message: `Crafted ${recipe.name}.`,
  };
}

export function upgradeWeapon(
  save: GameSaveRecord,
  itemId: string,
): { ok: boolean; save: GameSaveRecord; message: string } {
  const idx = save.payload.inventory.findIndex((i) => i.itemId === itemId);
  if (idx === -1) return { ok: false, save, message: 'Weapon not in inventory.' };

  const item = save.payload.inventory[idx];
  const currentLvl = item.upgradeLevel ?? 1;
  if (currentLvl >= 5) return { ok: false, save, message: 'Already at max Level 5.' };

  const scrapCost = currentLvl * 3;
  const partsCost = currentLvl >= 2 ? currentLvl - 1 : 0;

  let inv = removeItemFromInventory(save.payload.inventory, 'scrap_metal', scrapCost);
  if (!inv) return { ok: false, save, message: `Need ${scrapCost} Scrap Metal.` };
  if (partsCost > 0) {
    inv = removeItemFromInventory(inv, 'mechanical_parts', partsCost);
    if (!inv) return { ok: false, save, message: `Need ${partsCost} Mechanical Parts.` };
  }

  const targetIdx = inv.findIndex((i) => i.itemId === itemId);
  if (targetIdx !== -1) {
    inv[targetIdx] = { ...inv[targetIdx], upgradeLevel: currentLvl + 1, durability: 100 };
  }

  return {
    ok: true,
    save: {
      ...save,
      payload: {
        ...save.payload,
        inventory: inv,
        score: save.payload.score + 60,
      },
    },
    message: `Upgraded ${ITEMS_CATALOG[itemId]?.name ?? itemId} to Level ${currentLvl + 1}.`,
  };
}

export function computeWeaponDamage(save: GameSaveRecord, itemId: string): number {
  const def = ITEMS_CATALOG[itemId];
  if (!def || !def.damage) return 15;
  const char = getCharacterById(save.characterId);
  const invItem = save.payload.inventory.find((i) => i.itemId === itemId);
  const lvl = invItem?.upgradeLevel ?? 1;
  const upgradeMult = 1 + (lvl - 1) * 0.22;
  const roleMult =
    def.category === 'firearm'
      ? char.bonuses.firearmDmgMult ?? 1.0
      : char.bonuses.meleeDmgMult ?? 1.0;
  return Math.round(def.damage * upgradeMult * roleMult);
}

export function buildStructureInSave(
  save: GameSaveRecord,
  structureId: string,
  x: number,
  z: number,
): { ok: boolean; save: GameSaveRecord; message: string } {
  const def = BASE_STRUCTURES.find((s) => s.id === structureId);
  if (!def) return { ok: false, save, message: 'Unknown structure.' };

  let inv = save.payload.inventory;
  for (const cost of def.cost) {
    const nextInv = removeItemFromInventory(inv, cost.itemId, cost.qty);
    if (!nextInv) {
      const name = ITEMS_CATALOG[cost.itemId]?.name ?? cost.itemId;
      return { ok: false, save, message: `Need ${cost.qty} ${name}.` };
    }
    inv = nextInv;
  }

  const placed = {
    uid: `str_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    structureId,
    x: Math.round(x * 10) / 10,
    z: Math.round(z * 10) / 10,
    rotationY: 0,
    hp: def.maxHp,
    maxHp: def.maxHp,
  };

  return {
    ok: true,
    save: {
      ...save,
      payload: {
        ...save.payload,
        inventory: inv,
        structures: [...save.payload.structures, placed],
        score: save.payload.score + 50,
      },
    },
    message: `Built ${def.name}.`,
  };
}

export function advanceCalendar(
  save: GameSaveRecord,
  hoursDelta: number,
): { save: GameSaveRecord; newDayTriggered: boolean } {
  let time = save.timeOfDay + hoursDelta;
  let day = save.day;
  let newDayTriggered = false;
  let weather = save.weather;

  if (time >= 24) {
    const daysAdded = Math.floor(time / 24);
    time = time % 24;
    day += daysAdded;
    newDayTriggered = true;

    // Deterministic-friendly weather transition on new day
    const weathers: WeatherType[] = ['clear', 'clear', 'rain', 'fog', 'storm'];
    weather = weathers[(day * 3 + Math.floor(save.payload.zombieKills)) % weathers.length];
  }

  let inv = save.payload.inventory;
  if (newDayTriggered) {
    // Passive production from base structures & recruited survivors
    const farms = save.payload.structures.filter((s) => s.structureId === 'farm_plot').length;
    const purifiers = save.payload.structures.filter((s) => s.structureId === 'water_purifier').length;
    const farmerBonus = Object.values(save.payload.survivorTasks).filter((t) => t === 'Farm').length;
    const scavBonus = Object.values(save.payload.survivorTasks).filter((t) => t === 'Scavenge').length;

    if (farms + farmerBonus > 0) {
      inv = addItemToInventory(inv, 'fresh_vegetables', farms + farmerBonus);
    }
    if (purifiers > 0) {
      inv = addItemToInventory(inv, 'purified_water', purifiers);
    }
    if (scavBonus > 0) {
      inv = addItemToInventory(inv, 'scrap_metal', scavBonus);
    }
  }

  return {
    newDayTriggered,
    save: {
      ...save,
      day,
      timeOfDay: time,
      weather,
      payload: {
        ...save.payload,
        inventory: inv,
        score: save.payload.score + (newDayTriggered ? 100 : 0),
      },
    },
  };
}

export function evaluateAchievementsAndChapters(save: GameSaveRecord): {
  save: GameSaveRecord;
  newlyCompletedChapters: string[];
  newlyUnlockedAchievements: string[];
} {
  let inv = save.payload.inventory;
  const stats = { ...save.payload.stats };
  let score = save.payload.score;
  const completedChapters = [...save.payload.completedChapterIds];
  const newlyCompletedChapters: string[] = [];

  for (const ch of STORY_CHAPTERS) {
    if (completedChapters.includes(ch.id)) continue;
    let met = false;
    if (ch.objectiveType === 'kill_zombies' && save.payload.zombieKills >= ch.targetCount) met = true;
    if (ch.objectiveType === 'visit_zone' && save.payload.discoveredZoneIds.includes(String(ch.targetValue))) met = true;
    if (ch.objectiveType === 'recruit_survivor' && save.payload.recruitedIds.length >= ch.targetCount) met = true;
    if (ch.objectiveType === 'build_structures' && save.payload.structures.length >= ch.targetCount + 2) met = true;
    if (ch.objectiveType === 'defeat_boss' && save.payload.defeatedBossIds.includes(String(ch.targetValue))) met = true;
    if (ch.objectiveType === 'survive_day' && save.day >= Number(ch.targetValue)) met = true;

    if (met) {
      completedChapters.push(ch.id);
      newlyCompletedChapters.push(ch.title);
      stats.xp += ch.rewardXp;
      score += ch.rewardXp;
      for (const reward of ch.rewardItems) {
        inv = addItemToInventory(inv, reward.itemId, reward.qty);
      }
    }
  }

  // Level-up check
  while (stats.xp >= stats.level * 120) {
    stats.xp -= stats.level * 120;
    stats.level += 1;
    stats.maxHealth += 5;
    stats.health = Math.min(stats.maxHealth, stats.health + 15);
    stats.skillCombat += 1;
  }

  const unlocked = [...save.payload.unlockedAchievementIds];
  const newlyUnlockedAchievements: string[] = [];
  for (const ach of ACHIEVEMENTS_LIST) {
    if (unlocked.includes(ach.id)) continue;
    let reached = false;
    if (ach.metric === 'day' && save.day >= ach.threshold) reached = true;
    if (ach.metric === 'kills' && save.payload.zombieKills >= ach.threshold) reached = true;
    if (ach.metric === 'itemsCollected' && save.payload.itemsCollected >= ach.threshold) reached = true;
    if (ach.metric === 'crafted' && save.payload.itemsCrafted >= ach.threshold) reached = true;
    if (ach.metric === 'structures' && save.payload.structures.length >= ach.threshold) reached = true;
    if (ach.metric === 'recruited' && save.payload.recruitedIds.length >= ach.threshold) reached = true;
    if (ach.metric === 'juggernaut' && save.payload.defeatedBossIds.includes('juggernaut')) reached = true;
    if (ach.metric === 'origin' && save.payload.defeatedBossIds.includes('the_origin')) reached = true;
    if (reached) {
      unlocked.push(ach.id);
      newlyUnlockedAchievements.push(ach.title);
    }
  }

  return {
    newlyCompletedChapters,
    newlyUnlockedAchievements,
    save: {
      ...save,
      payload: {
        ...save.payload,
        stats,
        inventory: inv,
        completedChapterIds: completedChapters,
        unlockedAchievementIds: unlocked,
        score,
      },
    },
  };
}
