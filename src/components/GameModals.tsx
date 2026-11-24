import React, { useState } from 'react';
import {
  X,
  Wrench,
  Save,
  RotateCcw,
  Home,
  CheckCircle2,
  Skull,
  Award,
  MapPin,
  Shield,
  Database,
} from 'lucide-react';
import {
  ACHIEVEMENTS_LIST,
  BASE_STRUCTURES,
  CRAFTING_RECIPES,
  ITEMS_CATALOG,
  RECRUITABLE_SURVIVORS,
  STORY_CHAPTERS,
  WORLD_ZONES,
  ZOMBIE_DEFINITIONS,
} from '../game/data';
import {
  buildStructureInSave,
  computeWeaponDamage,
  consumeItem,
  craftRecipe,
  evaluateAchievementsAndChapters,
  getDayPhaseLabel,
  getItemCount,
  upgradeWeapon,
} from '../game/simulation';
import type { GameSaveRecord, SurvivorNPC } from '../game/types';
import type { ActiveModalTab } from './SurvivalHUD';

interface Props {
  activeTab: ActiveModalTab;
  gameOver: boolean;
  save: GameSaveRecord;
  cloudSaving: boolean;
  onClose: () => void;
  onSwitchTab: (tab: ActiveModalTab) => void;
  onUpdateSave: (next: GameSaveRecord, toastMsg?: string, syncCloud?: boolean) => void;
  onManualSave: () => void;
  onOpenPortal: () => void;
  onRestartGame: () => void;
  onReturnTitle: () => void;
}

export const GameModals: React.FC<Props> = ({
  activeTab,
  gameOver,
  save,
  cloudSaving,
  onClose,
  onSwitchTab,
  onUpdateSave,
  onManualSave,
  onOpenPortal,
  onRestartGame,
  onReturnTitle,
}) => {
  const [codexView, setCodexView] = useState<'zombies' | 'achievements'>('zombies');

  if (gameOver) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
        <div className="w-full max-w-md rounded-lg border border-red-800/70 bg-[#121418] p-6 text-center shadow-2xl space-y-5">
          <Skull className="mx-auto h-12 w-12 text-red-500" />
          <div>
            <h2 className="font-display text-4xl font-bold text-red-500">YOU PERISHED</h2>
            <p className="mt-1 text-sm text-stone-400">
              Survived until Day {save.day} · {getDayPhaseLabel(save.day)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded bg-stone-900/90 p-3 text-xs">
            <div>
              <div className="text-stone-400">Days</div>
              <div className="font-mono-tabular text-lg font-bold text-stone-100">{save.day}</div>
            </div>
            <div>
              <div className="text-stone-400">Infected Slain</div>
              <div className="font-mono-tabular text-lg font-bold text-amber-400">
                {save.payload.zombieKills}
              </div>
            </div>
            <div>
              <div className="text-stone-400">Score</div>
              <div className="font-mono-tabular text-lg font-bold text-emerald-400">
                {save.payload.score}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              data-start="true"
              onClick={onRestartGame}
              className="flex-1 flex items-center justify-center gap-2 rounded bg-amber-600 hover:bg-amber-500 py-3 text-sm font-bold text-stone-950"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again (Day 1)
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="flex-1 flex items-center justify-center gap-2 rounded border border-stone-700 bg-stone-800 hover:bg-stone-700 py-3 text-sm font-semibold text-stone-200"
            >
              <Home className="h-4 w-4" />
              Title Screen
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeTab) return null;

  const handleUseItem = (itemId: string) => {
    const res = consumeItem(save, itemId);
    onUpdateSave(res.save, res.message, res.ok);
  };

  const handleEquip = (itemId: string) => {
    const def = ITEMS_CATALOG[itemId];
    if (!def) return;
    const nextPayload = { ...save.payload };
    if (def.category === 'firearm') nextPayload.equippedWeaponId = itemId;
    else if (def.category === 'melee') {
      nextPayload.equippedMeleeId = itemId;
      nextPayload.equippedWeaponId = itemId;
    } else if (def.category === 'armor') nextPayload.equippedArmorId = itemId;
    else if (def.category === 'backpack') nextPayload.equippedBackpackId = itemId;
    onUpdateSave({ ...save, payload: nextPayload }, `Equipped ${def.name}.`);
  };

  const handleUpgrade = (itemId: string) => {
    const res = upgradeWeapon(save, itemId);
    onUpdateSave(res.save, res.message, res.ok);
  };

  const handleCraft = (recipeId: string) => {
    const res = craftRecipe(save, recipeId);
    if (res.ok) {
      const evaluated = evaluateAchievementsAndChapters(res.save);
      onUpdateSave(evaluated.save, res.message, true);
    } else {
      onUpdateSave(res.save, res.message, false);
    }
  };

  const handleBuild = (structureId: string) => {
    const angle = save.payload.structures.length * 0.9;
    const bx = save.payload.position.x + Math.cos(angle) * 4.5;
    const bz = save.payload.position.z + Math.sin(angle) * 4.5;
    const res = buildStructureInSave(save, structureId, bx, bz);
    if (res.ok) {
      const evaluated = evaluateAchievementsAndChapters(res.save);
      onUpdateSave(evaluated.save, res.message, true);
    } else {
      onUpdateSave(res.save, res.message, false);
    }
  };

  const handleUpgradeWorkbench = () => {
    const lvl = save.payload.workbenchLevel;
    if (lvl >= 3) return;
    const scrap = getItemCount(save.payload.inventory, 'scrap_metal');
    if (scrap < 5 * lvl) {
      onUpdateSave(save, `Need ${5 * lvl} Scrap Metal to upgrade Workbench.`);
      return;
    }
    const nextInv = save.payload.inventory.map((i) => ({ ...i }));
    let rem = 5 * lvl;
    for (const item of nextInv) {
      if (item.itemId === 'scrap_metal' && rem > 0) {
        const take = Math.min(item.qty, rem);
        item.qty -= take;
        rem -= take;
      }
    }
    onUpdateSave(
      {
        ...save,
        payload: {
          ...save.payload,
          inventory: nextInv.filter((i) => i.qty > 0),
          workbenchLevel: lvl + 1,
        },
      },
      `Workbench upgraded to Level ${lvl + 1}!`,
      true,
    );
  };

  const handleAssignTask = (npcId: string, task: SurvivorNPC['assignedTask']) => {
    onUpdateSave(
      {
        ...save,
        payload: {
          ...save.payload,
          survivorTasks: { ...save.payload.survivorTasks, [npcId]: task },
        },
      },
      'Updated survivor assignment.',
      true,
    );
  };

  const handleFastTravel = (zoneId: string) => {
    const zone = WORLD_ZONES.find((z) => z.id === zoneId);
    if (!zone) return;
    onUpdateSave(
      {
        ...save,
        payload: {
          ...save.payload,
          position: { x: zone.centerX, z: zone.centerZ + 6 },
        },
      },
      `Moved to ${zone.name}.`,
    );
    onClose();
  };

  const tabs: { id: ActiveModalTab; label: string }[] = [
    { id: 'inventory', label: 'Inventory & Gear' },
    { id: 'crafting', label: 'Craft & Build' },
    { id: 'map', label: 'Map & Story' },
    { id: 'base', label: 'Settlement' },
    { id: 'codex', label: 'Encyclopedia' },
    { id: 'pause', label: 'Save & Menu' },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-2 sm:p-6">
      <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border border-stone-700 bg-[#101419] shadow-2xl overflow-hidden">
        {/* Top Navigation Strip */}
        <div className="flex items-center justify-between gap-2 border-b border-stone-800 px-3 py-2.5 sm:px-5 bg-[#0c0f13]">
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSwitchTab(t.id)}
                className={`rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  activeTab === t.id
                    ? 'bg-amber-600 text-stone-950'
                    : 'text-stone-300 hover:bg-stone-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Resume Survival"
            className="rounded border border-stone-700 p-1.5 text-stone-300 hover:bg-stone-800 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'inventory' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-md border border-stone-800 bg-[#161b22] p-3 text-xs">
                <div>
                  <span className="text-stone-400">Primary</span>
                  <div className="font-bold text-stone-100">
                    {ITEMS_CATALOG[save.payload.equippedWeaponId]?.name ?? 'None'}
                  </div>
                </div>
                <div>
                  <span className="text-stone-400">Melee Backup</span>
                  <div className="font-bold text-stone-100">
                    {ITEMS_CATALOG[save.payload.equippedMeleeId]?.name ?? 'None'}
                  </div>
                </div>
                <div>
                  <span className="text-stone-400">Armor</span>
                  <div className="font-bold text-stone-100">
                    {save.payload.equippedArmorId
                      ? ITEMS_CATALOG[save.payload.equippedArmorId]?.name
                      : 'None'}
                  </div>
                </div>
                <div>
                  <span className="text-stone-400">Backpack</span>
                  <div className="font-bold text-stone-100">
                    {ITEMS_CATALOG[save.payload.equippedBackpackId]?.name}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {save.payload.inventory.map((item, idx) => {
                  const def = ITEMS_CATALOG[item.itemId];
                  if (!def) return null;
                  const isConsumable =
                    def.category === 'food' ||
                    def.category === 'water' ||
                    def.category === 'medicine';
                  const isEquipable =
                    def.category === 'firearm' ||
                    def.category === 'melee' ||
                    def.category === 'armor' ||
                    def.category === 'backpack';
                  const isWeapon = def.category === 'firearm' || def.category === 'melee';
                  const isEquipped =
                    save.payload.equippedWeaponId === item.itemId ||
                    save.payload.equippedArmorId === item.itemId ||
                    save.payload.equippedBackpackId === item.itemId;

                  return (
                    <div
                      key={`${item.itemId}_${idx}`}
                      className="flex flex-col justify-between rounded-md border border-stone-800 bg-[#151a21] p-3"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-sm text-stone-100">
                            {def.name}{' '}
                            {item.qty > 1 && (
                              <span className="font-mono-tabular text-amber-400">×{item.qty}</span>
                            )}
                          </div>
                          <span className="text-[11px] text-stone-400">{def.rarity}</span>
                        </div>
                        <p className="mt-1 text-xs text-stone-400">{def.description}</p>
                        {isWeapon && (
                          <div className="mt-1.5 text-[11px] font-mono-tabular text-amber-300">
                            Lvl {item.upgradeLevel ?? 1}/5 · DMG{' '}
                            {computeWeaponDamage(save, item.itemId)}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {isConsumable && (
                          <button
                            type="button"
                            onClick={() => handleUseItem(item.itemId)}
                            className="rounded bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Use
                          </button>
                        )}
                        {isEquipable && (
                          <button
                            type="button"
                            onClick={() => handleEquip(item.itemId)}
                            className={`rounded px-3 py-1.5 text-xs font-semibold ${
                              isEquipped
                                ? 'bg-amber-600 text-stone-950'
                                : 'bg-stone-700 hover:bg-stone-600 text-stone-100'
                            }`}
                          >
                            {isEquipped ? 'Equipped' : 'Equip'}
                          </button>
                        )}
                        {isWeapon && (item.upgradeLevel ?? 1) < 5 && (
                          <button
                            type="button"
                            onClick={() => handleUpgrade(item.itemId)}
                            className="flex items-center gap-1 rounded border border-amber-600/60 px-2.5 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-600/20"
                          >
                            <Wrench className="h-3 w-3" />
                            Upgrade
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'crafting' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-800 bg-[#161b22] p-3.5">
                <div>
                  <div className="font-display text-xl font-bold text-stone-100">
                    Field Workbench Level {save.payload.workbenchLevel} / 3
                  </div>
                  <div className="text-xs text-stone-400">
                    Higher workbench tiers unlock steel melee weapons, rifle ammunition, and antivirals.
                  </div>
                </div>
                {save.payload.workbenchLevel < 3 && (
                  <button
                    type="button"
                    onClick={handleUpgradeWorkbench}
                    className="rounded bg-amber-600 hover:bg-amber-500 px-3.5 py-2 text-xs font-bold text-stone-950"
                  >
                    Upgrade ({5 * save.payload.workbenchLevel} Scrap Metal)
                  </button>
                )}
              </div>

              <div>
                <h3 className="font-display text-xl font-bold text-stone-100 mb-3">
                  Crafting Recipes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CRAFTING_RECIPES.map((rec) => {
                    const locked = save.payload.workbenchLevel < rec.workbenchLevel;
                    return (
                      <div
                        key={rec.id}
                        className="flex flex-col justify-between rounded-md border border-stone-800 bg-[#151a21] p-3"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-stone-100">{rec.name}</span>
                            <span className="text-[11px] text-stone-400">
                              WB Lvl {rec.workbenchLevel}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-stone-400">
                            {rec.ingredients.map((ing) => {
                              const owned = getItemCount(save.payload.inventory, ing.itemId);
                              return (
                                <div key={ing.itemId} className="flex justify-between">
                                  <span>{ITEMS_CATALOG[ing.itemId]?.name}</span>
                                  <span
                                    className={`font-mono-tabular ${
                                      owned >= ing.qty ? 'text-emerald-400' : 'text-red-400'
                                    }`}
                                  >
                                    {owned}/{ing.qty}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => handleCraft(rec.id)}
                          className="mt-3 w-full rounded bg-amber-600 hover:bg-amber-500 disabled:bg-stone-800 disabled:text-stone-500 py-2 text-xs font-bold text-stone-950"
                        >
                          {locked ? `Requires Workbench ${rec.workbenchLevel}` : 'Craft'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="font-display text-xl font-bold text-stone-100 mb-3">
                  Base Building (Places 3D Structure Nearby)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {BASE_STRUCTURES.map((st) => (
                    <div
                      key={st.id}
                      className="flex flex-col justify-between rounded-md border border-stone-800 bg-[#151a21] p-3"
                    >
                      <div>
                        <div className="font-semibold text-sm text-stone-100">{st.name}</div>
                        <p className="mt-1 text-xs text-stone-400">{st.description}</p>
                        <div className="mt-2 space-y-1 text-xs text-stone-400">
                          {st.cost.map((c) => {
                            const owned = getItemCount(save.payload.inventory, c.itemId);
                            return (
                              <div key={c.itemId} className="flex justify-between">
                                <span>{ITEMS_CATALOG[c.itemId]?.name}</span>
                                <span
                                  className={`font-mono-tabular ${
                                    owned >= c.qty ? 'text-emerald-400' : 'text-red-400'
                                  }`}
                                >
                                  {owned}/{c.qty}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleBuild(st.id)}
                        className="mt-3 w-full rounded bg-stone-700 hover:bg-amber-600 hover:text-stone-950 py-2 text-xs font-bold text-stone-100 transition-colors"
                      >
                        Build Structure
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'map' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* 9 Regions List & Travel */}
              <div className="lg:col-span-7 space-y-3">
                <h3 className="font-display text-xl font-bold text-stone-100">
                  9 Open-World Regions
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {WORLD_ZONES.map((z) => {
                    const discovered = save.payload.discoveredZoneIds.includes(z.id);
                    return (
                      <div
                        key={z.id}
                        className="rounded-md border border-stone-800 bg-[#151a21] p-3 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-stone-100">{z.name}</span>
                            <span className="text-[11px] font-mono-tabular text-amber-400">
                              Danger {z.dangerLevel}/5
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-stone-400">{z.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFastTravel(z.id)}
                          className="mt-3 flex items-center justify-center gap-1.5 rounded border border-stone-700 bg-stone-800 hover:bg-amber-600 hover:text-stone-950 py-1.5 text-xs font-semibold text-stone-200 transition-colors"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          {discovered ? 'Travel to Zone' : 'Expedition March'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 7 Story Chapters */}
              <div className="lg:col-span-5 space-y-3">
                <h3 className="font-display text-xl font-bold text-stone-100">
                  Story Campaign (7 Chapters)
                </h3>
                <div className="space-y-2.5">
                  {STORY_CHAPTERS.map((ch) => {
                    const done = save.payload.completedChapterIds.includes(ch.id);
                    return (
                      <div
                        key={ch.id}
                        className={`rounded-md border p-3 ${
                          done
                            ? 'border-emerald-700/60 bg-emerald-950/25'
                            : 'border-stone-800 bg-[#151a21]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-stone-100">{ch.title}</span>
                          {done && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                        </div>
                        <p className="mt-1 text-xs text-stone-400">{ch.description}</p>
                        <div className="mt-1.5 text-[11px] text-amber-400">
                          Reward: +{ch.rewardXp} XP
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'base' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded border border-stone-800 bg-[#151a21] p-3">
                  <div className="text-xs text-stone-400">Built Structures</div>
                  <div className="font-mono-tabular text-2xl font-bold text-stone-100">
                    {save.payload.structures.length}
                  </div>
                </div>
                <div className="rounded border border-stone-800 bg-[#151a21] p-3">
                  <div className="text-xs text-stone-400">Survivors Recruited</div>
                  <div className="font-mono-tabular text-2xl font-bold text-emerald-400">
                    {save.payload.recruitedIds.length} / {RECRUITABLE_SURVIVORS.length}
                  </div>
                </div>
                <div className="rounded border border-stone-800 bg-[#151a21] p-3">
                  <div className="text-xs text-stone-400">Base Security</div>
                  <div className="font-mono-tabular text-2xl font-bold text-amber-400">
                    {save.payload.structures.length * 15 + save.payload.recruitedIds.length * 20}
                  </div>
                </div>
                <div className="rounded border border-stone-800 bg-[#151a21] p-3">
                  <div className="text-xs text-stone-400">Power Balance</div>
                  <div className="font-mono-tabular text-2xl font-bold text-sky-400">
                    +{save.payload.structures.filter((s) => s.structureId === 'solar_panel').length * 4} kW
                  </div>
                </div>
              </div>

              <h3 className="font-display text-xl font-bold text-stone-100">
                Survivor Community Roster
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {RECRUITABLE_SURVIVORS.map((npc) => {
                  const recruited = save.payload.recruitedIds.includes(npc.id);
                  const currentTask = save.payload.survivorTasks[npc.id] ?? npc.assignedTask;
                  const zone = WORLD_ZONES.find((z) => z.id === npc.zoneId);
                  return (
                    <div
                      key={npc.id}
                      className="rounded-md border border-stone-800 bg-[#151a21] p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm text-stone-100">
                            {npc.name} · {npc.role}
                          </div>
                          <div className="text-xs text-stone-400">{npc.background}</div>
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            recruited ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {recruited ? 'In Haven' : `At ${zone?.name}`}
                        </span>
                      </div>

                      {recruited && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {(['Guard', 'Infirmary', 'Farm', 'Maintenance', 'Scavenge'] as const).map(
                            (task) => (
                              <button
                                key={task}
                                type="button"
                                onClick={() => handleAssignTask(npc.id, task)}
                                className={`rounded px-2.5 py-1 text-[11px] font-semibold ${
                                  currentTask === task
                                    ? 'bg-amber-600 text-stone-950'
                                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                                }`}
                              >
                                {task}
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'codex' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCodexView('zombies')}
                  className={`rounded px-3.5 py-1.5 text-xs font-bold ${
                    codexView === 'zombies'
                      ? 'bg-amber-600 text-stone-950'
                      : 'bg-stone-800 text-stone-300'
                  }`}
                >
                  Infected & Bosses (12)
                </button>
                <button
                  type="button"
                  onClick={() => setCodexView('achievements')}
                  className={`rounded px-3.5 py-1.5 text-xs font-bold ${
                    codexView === 'achievements'
                      ? 'bg-amber-600 text-stone-950'
                      : 'bg-stone-800 text-stone-300'
                  }`}
                >
                  Achievements ({save.payload.unlockedAchievementIds.length}/{ACHIEVEMENTS_LIST.length})
                </button>
              </div>

              {codexView === 'zombies' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ZOMBIE_DEFINITIONS.map((z) => {
                    const bossSlain = save.payload.defeatedBossIds.includes(z.id);
                    return (
                      <div
                        key={z.id}
                        className="rounded-md border border-stone-800 bg-[#151a21] p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-stone-100">{z.name}</span>
                          <span
                            className={`text-[11px] font-semibold ${
                              z.isBoss ? 'text-red-400' : 'text-stone-400'
                            }`}
                          >
                            {z.isBoss ? (bossSlain ? 'BOSS SLAIN' : 'WORLD BOSS') : `Tier ${z.tier}`}
                          </span>
                        </div>
                        <p className="text-xs text-stone-400">{z.history}</p>
                        <div className="text-[11px] font-mono-tabular text-amber-400">
                          HP {z.baseHp} · DMG {z.damage} · SPD {z.speed}
                        </div>
                        <div className="text-[11px] text-stone-300">
                          Traits: {z.abilities.join(' · ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ACHIEVEMENTS_LIST.map((ach) => {
                    const unlocked = save.payload.unlockedAchievementIds.includes(ach.id);
                    return (
                      <div
                        key={ach.id}
                        className={`flex items-center gap-3 rounded-md border p-3 ${
                          unlocked
                            ? 'border-amber-600/70 bg-amber-950/20'
                            : 'border-stone-800 bg-[#151a21] opacity-75'
                        }`}
                      >
                        <Award
                          className={`h-6 w-6 shrink-0 ${
                            unlocked ? 'text-amber-400' : 'text-stone-600'
                          }`}
                        />
                        <div>
                          <div className="font-semibold text-sm text-stone-100">{ach.title}</div>
                          <div className="text-xs text-stone-400">{ach.description}</div>
                          <div className="text-[11px] text-amber-400 mt-0.5">
                            Reward Title: {ach.rewardTitle}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pause' && (
            <div className="mx-auto max-w-md space-y-4 py-4">
              <div className="text-center">
                <Shield className="mx-auto h-10 w-10 text-amber-500" />
                <h3 className="mt-2 font-display text-3xl font-bold text-stone-100">
                  SURVIVAL PAUSED
                </h3>
                <p className="text-xs text-stone-400">
                  Day {save.day} · {getDayPhaseLabel(save.day)} · {save.difficulty.toUpperCase()}
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded bg-amber-600 hover:bg-amber-500 py-3 text-sm font-bold text-stone-950"
                >
                  Resume Survival
                </button>
                <button
                  type="button"
                  disabled={cloudSaving}
                  onClick={onManualSave}
                  className="w-full flex items-center justify-center gap-2 rounded border border-emerald-700 bg-emerald-800/80 hover:bg-emerald-700 py-3 text-sm font-bold text-white"
                >
                  <Save className="h-4 w-4" />
                  {cloudSaving ? 'Saving to Cloud...' : 'Save Progress Now'}
                </button>
                <button
                  type="button"
                  onClick={onOpenPortal}
                  className="w-full flex items-center justify-center gap-2 rounded border border-amber-700/70 bg-stone-800 hover:bg-stone-700 py-2.5 text-sm font-semibold text-amber-300"
                >
                  <Database className="h-4 w-4" />
                  Manage Save Slots & Backups
                </button>
                <button
                  type="button"
                  onClick={onRestartGame}
                  className="w-full flex items-center justify-center gap-2 rounded border border-stone-700 bg-stone-800 hover:bg-stone-700 py-2.5 text-sm font-semibold text-stone-200"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restart from Day 1
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onManualSave();
                    onReturnTitle();
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded border border-stone-700 bg-stone-900 hover:bg-stone-800 py-2.5 text-sm font-semibold text-stone-300"
                >
                  <Home className="h-4 w-4" />
                  Save & Exit to Title
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
