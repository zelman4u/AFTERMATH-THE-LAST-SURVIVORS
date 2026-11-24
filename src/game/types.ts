export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';
export type GameMode = 'story' | 'endless';
export type DifficultyLevel = 'normal' | 'hard' | 'nightmare';
export type WeatherType = 'clear' | 'rain' | 'storm' | 'fog';

export type ItemCategory =
  | 'food'
  | 'water'
  | 'medicine'
  | 'melee'
  | 'firearm'
  | 'ammo'
  | 'armor'
  | 'backpack'
  | 'material';

export type ItemRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Experimental';

export interface CharacterProfile {
  id: string;
  name: string;
  title: string;
  age: number;
  gender: 'Male' | 'Female';
  occupation: string;
  familyBackground: string;
  history: string;
  outbreakSurvival: string;
  personality: string;
  specialty: string;
  weakness: string;
  personalMissionTitle: string;
  personalMissionDesc: string;
  accentColor: string;
  clothingColor: string;
  skinTone: string;
  hairColor: string;
  buildScale: [number, number, number];
  startingItems: { itemId: string; qty: number }[];
  startingWeaponId: string;
  bonuses: {
    maxHealth?: number;
    maxStamina?: number;
    firearmDmgMult?: number;
    meleeDmgMult?: number;
    healMult?: number;
    craftYieldBonus?: number;
    moveSpeedMult?: number;
    hungerDrainMult?: number;
    stealthMult?: number;
  };
  quote: string;
}

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  description: string;
  weight: number;
  stackable: boolean;
  hungerRestore?: number;
  thirstRestore?: number;
  healthRestore?: number;
  infectionCure?: number;
  energyRestore?: number;
  curesBleeding?: boolean;
  damage?: number;
  range?: number;
  cooldown?: number;
  noiseRadius?: number;
  magSize?: number;
  ammoType?: string;
  armorDefense?: number;
  backpackBonusKg?: number;
  coldInsulation?: number;
}

export interface InventoryItem {
  itemId: string;
  qty: number;
  upgradeLevel?: number;
  durability?: number;
  attachments?: string[];
}

export type ZombieTier = 1 | 2 | 3;
export type ZombieBehaviorPolicy = 'swarmer' | 'runner' | 'screamer' | 'brute' | 'spitter' | 'stalker' | 'boss';

export interface ZombieDefinition {
  id: string;
  name: string;
  tier: ZombieTier;
  isBoss: boolean;
  policy: ZombieBehaviorPolicy;
  history: string;
  baseHp: number;
  speed: number;
  damage: number;
  attackRange: number;
  detectRange: number;
  xpReward: number;
  scale: [number, number, number];
  skinColor: string;
  accentColor: string;
  drops: string[];
  abilities: string[];
  nightOnly?: boolean;
}

export interface WorldZone {
  id: string;
  name: string;
  description: string;
  centerX: number;
  centerZ: number;
  radius: number;
  dangerLevel: number;
  lootPool: string[];
  color: string;
  unlockDay: number;
}

export interface CraftingRecipe {
  id: string;
  resultItemId: string;
  resultQty: number;
  name: string;
  category: 'Weapons' | 'Survival' | 'Medicine' | 'Structures';
  workbenchLevel: number;
  ingredients: { itemId: string; qty: number }[];
}

export interface StructureDefinition {
  id: string;
  name: string;
  description: string;
  category: 'Defense' | 'Utility' | 'Production';
  cost: { itemId: string; qty: number }[];
  maxHp: number;
  noiseLevel: number;
  powerDelta: number;
  color: string;
}

export interface PlacedStructure {
  uid: string;
  structureId: string;
  x: number;
  z: number;
  rotationY: number;
  hp: number;
  maxHp: number;
}

export interface SurvivorNPC {
  id: string;
  name: string;
  age: number;
  role: 'Guard' | 'Medic' | 'Farmer' | 'Engineer' | 'Scavenger';
  background: string;
  personality: string;
  zoneId: string;
  spawnX: number;
  spawnZ: number;
  recruited: boolean;
  trust: number;
  assignedTask: 'Guard' | 'Infirmary' | 'Farm' | 'Maintenance' | 'Scavenge';
  shirtColor: string;
}

export interface StoryChapter {
  id: string;
  chapterNumber: number;
  title: string;
  description: string;
  objectiveType: 'survive_day' | 'visit_zone' | 'kill_zombies' | 'craft_items' | 'build_structures' | 'recruit_survivor' | 'defeat_boss';
  targetValue: string | number;
  targetCount: number;
  rewardXp: number;
  rewardItems: { itemId: string; qty: number }[];
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  metric: 'day' | 'kills' | 'crafted' | 'itemsCollected' | 'injuriesTreated' | 'recruited' | 'structures' | 'juggernaut' | 'origin';
  threshold: number;
  rewardTitle: string;
}

export interface PlayerStats {
  health: number;
  maxHealth: number;
  hunger: number;
  thirst: number;
  stamina: number;
  maxStamina: number;
  energy: number;
  temperature: number;
  infection: number;
  blood: number;
  sanity: number;
  bleeding: boolean;
  exhausted: boolean;
  hypothermia: boolean;
  level: number;
  xp: number;
  skillCombat: number;
  skillMedical: number;
  skillCrafting: number;
  skillSurvival: number;
}

export interface GameSavePayload {
  stats: PlayerStats;
  position: { x: number; z: number };
  inventory: InventoryItem[];
  equippedWeaponId: string;
  equippedMeleeId: string;
  equippedArmorId: string | null;
  equippedBackpackId: string;
  ammoInMag: Record<string, number>;
  structures: PlacedStructure[];
  recruitedIds: string[];
  survivorTasks: Record<string, SurvivorNPC['assignedTask']>;
  survivorTrust: Record<string, number>;
  completedChapterIds: string[];
  defeatedBossIds: string[];
  unlockedAchievementIds: string[];
  discoveredZoneIds: string[];
  lootedContainerIds: string[];
  zombieKills: number;
  itemsCollected: number;
  itemsCrafted: number;
  injuriesTreated: number;
  workbenchLevel: number;
  inVehicle: boolean;
  vehicleFuel: number;
  vehicleHealth: number;
  score: number;
}

export interface GameSaveRecord {
  saveId: string;
  ownerId: string;
  version: number;
  characterId: string;
  mode: GameMode;
  difficulty: DifficultyLevel;
  day: number;
  timeOfDay: number;
  weather: WeatherType;
  payload: GameSavePayload;
  updatedAtIso: string;
}

export interface HudSnapshot {
  stats: PlayerStats;
  day: number;
  timeOfDay: number;
  weather: WeatherType;
  zoneName: string;
  zoneId: string;
  equippedWeaponId: string;
  equippedWeaponName: string;
  magAmmo: number;
  reserveAmmo: number;
  weightKg: number;
  maxWeightKg: number;
  zombieKills: number;
  score: number;
  nearbyPrompt: string | null;
  nearbyTargetType: 'loot' | 'npc' | 'vehicle' | 'bed' | 'workbench' | 'campfire' | null;
  activeBoss: { name: string; hp: number; maxHp: number } | null;
  inVehicle: boolean;
  vehicleFuel: number;
  noiseLevel: number;
  isCrouching: boolean;
  playerX: number;
  playerZ: number;
  activeEventBanner: string | null;
}
