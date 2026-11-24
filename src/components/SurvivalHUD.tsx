import React, { useRef, useState } from 'react';
import {
  Backpack,
  BookOpen,
  Compass,
  Hammer,
  Pause,
  Shield,
  Users,
  Volume2,
  VolumeX,
  Gamepad2,
} from 'lucide-react';
import { WORLD_ZONES } from '../game/data';
import { getDayPhaseLabel } from '../game/simulation';
import type { HudSnapshot } from '../game/types';

export type ActiveModalTab =
  | null
  | 'inventory'
  | 'crafting'
  | 'map'
  | 'base'
  | 'codex'
  | 'pause';

interface Props {
  hud: HudSnapshot;
  characterName: string;
  muted: boolean;
  touchEnabled: boolean;
  toast: string | null;
  onToggleTouch: () => void;
  onToggleMute: () => void;
  onOpenModal: (tab: ActiveModalTab) => void;
  onQuickConsume: (category: 'food' | 'water' | 'medicine') => void;
  onTouchMove: (x: number, z: number) => void;
  onTouchSprint: (active: boolean) => void;
  onAttack: () => void;
  onInteract: () => void;
  onReload: () => void;
  onCrouch: () => void;
}

function formatClock(hours: number): string {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const SurvivalHUD: React.FC<Props> = ({
  hud,
  characterName,
  muted,
  touchEnabled,
  toast,
  onToggleTouch,
  onToggleMute,
  onOpenModal,
  onQuickConsume,
  onTouchMove,
  onTouchSprint,
  onAttack,
  onInteract,
  onReload,
  onCrouch,
}) => {
  const stickRef = useRef<HTMLDivElement | null>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [sprintHeld, setSprintHeld] = useState(false);

  const handleStickPointer = (clientX: number, clientY: number) => {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width / 2 - 14;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnobPos({ x: dx, y: dy });
    onTouchMove(dx / maxR, dy / maxR);
  };

  const resetStick = () => {
    setKnobPos({ x: 0, y: 0 });
    onTouchMove(0, 0);
  };

  const hpPct = Math.max(0, Math.min(100, (hud.stats.health / hud.stats.maxHealth) * 100));
  const stmPct = Math.max(0, Math.min(100, (hud.stats.stamina / hud.stats.maxStamina) * 100));

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-2.5 sm:p-4 select-none">
      {/* Low Health Peripheral Vignette */}
      {hpPct < 30 && (
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            boxShadow: 'inset 0 0 90px rgba(220, 38, 38, 0.48)',
          }}
        />
      )}

      {/* Center Tactical Crosshair */}
      <div className="pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="2" fill="#f59e0b" fillOpacity="0.9" />
          <path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke="#f8fafc" strokeWidth="1.4" strokeOpacity="0.6" />
        </svg>
      </div>

      {/* TOP ROW: Vitals Cluster (Left) + Boss/Toast (Center) + Utility & Minimap (Right) */}
      <div className="flex items-start justify-between gap-2">
        {/* Top-Left Vitals & Calendar */}
        <div className="pointer-events-auto w-[176px] sm:w-64 rounded-md border border-stone-700/70 bg-[#0d1116]/90 p-2 sm:p-2.5 shadow-lg">
          <div className="flex items-baseline justify-between gap-2 border-b border-stone-800 pb-1.5">
            <div className="min-w-0">
              <div className="font-display text-lg font-bold leading-none text-stone-100 truncate">
                DAY <span className="tabular-nums text-amber-500">{hud.day}</span> · {formatClock(hud.timeOfDay)}
              </div>
              <div className="mt-0.5 text-[11px] text-stone-400 truncate">
                {hud.zoneName} · {hud.weather.toUpperCase()}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-stone-400">{characterName.split(' ')[0]}</div>
              <div className="font-mono-tabular text-[11px] font-semibold text-amber-400">
                LVL {hud.stats.level}
              </div>
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            {/* Health */}
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-9 font-semibold text-red-400">HP</span>
              <div className="h-2 flex-1 overflow-hidden rounded-sm bg-stone-800">
                <div
                  className="h-full bg-red-600 transition-transform duration-150 origin-left"
                  style={{ transform: `scaleX(${hpPct / 100})` }}
                />
              </div>
              <span className="w-8 text-right font-mono-tabular text-stone-200">
                {Math.round(hud.stats.health)}
              </span>
            </div>

            {/* Stamina */}
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-9 font-semibold text-amber-400">STM</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-stone-800">
                <div
                  className="h-full bg-amber-500 transition-transform duration-150 origin-left"
                  style={{ transform: `scaleX(${stmPct / 100})` }}
                />
              </div>
              <span className="w-8 text-right font-mono-tabular text-stone-300">
                {Math.round(hud.stats.stamina)}
              </span>
            </div>

            {/* Hunger & Thirst compact grid */}
            <div className="grid grid-cols-2 gap-2 pt-0.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="text-orange-400 font-semibold">FOOD</span>
                <div className="h-1.5 flex-1 rounded-sm bg-stone-800 overflow-hidden">
                  <div
                    className="h-full bg-orange-500 origin-left"
                    style={{ transform: `scaleX(${hud.stats.hunger / 100})` }}
                  />
                </div>
                <span className="font-mono-tabular text-stone-300">{Math.round(hud.stats.hunger)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sky-400 font-semibold">H2O</span>
                <div className="h-1.5 flex-1 rounded-sm bg-stone-800 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 origin-left"
                    style={{ transform: `scaleX(${hud.stats.thirst / 100})` }}
                  />
                </div>
                <span className="font-mono-tabular text-stone-300">{Math.round(hud.stats.thirst)}</span>
              </div>
            </div>

            {/* Temp, Infection & Phase */}
            <div className="flex items-center justify-between pt-0.5 text-[10px] text-stone-400 font-mono-tabular">
              <span>{hud.stats.temperature.toFixed(1)}°C</span>
              <span className={hud.stats.infection > 25 ? 'text-purple-400 font-bold' : ''}>
                INF {Math.round(hud.stats.infection)}%
              </span>
              <span>KILLS {hud.zombieKills}</span>
            </div>

            {(hud.stats.bleeding || hud.stats.hypothermia || hud.stats.exhausted) && (
              <div className="flex flex-wrap gap-2 pt-0.5 text-[10px] font-bold text-red-400">
                {hud.stats.bleeding && <span>BLEEDING</span>}
                {hud.stats.hypothermia && <span>HYPOTHERMIA</span>}
                {hud.stats.exhausted && <span>EXHAUSTED</span>}
              </div>
            )}
          </div>
        </div>

        {/* Top-Center Boss Bar & Event Alerts */}
        <div className="hidden md:flex flex-col items-center gap-2 max-w-md flex-1">
          {hud.activeBoss && (
            <div className="w-full rounded-md border border-red-700/80 bg-[#140c0e]/92 px-4 py-2 shadow-xl">
              <div className="flex items-center justify-between text-xs font-bold text-red-300">
                <span className="font-display text-base tracking-wide uppercase">
                  {hud.activeBoss.name}
                </span>
                <span className="font-mono-tabular">
                  {hud.activeBoss.hp} / {hud.activeBoss.maxHp}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-sm bg-stone-900">
                <div
                  className="h-full bg-red-600 transition-transform duration-150 origin-left"
                  style={{ transform: `scaleX(${Math.max(0, hud.activeBoss.hp / hud.activeBoss.maxHp)})` }}
                />
              </div>
            </div>
          )}

          {(toast || hud.activeEventBanner) && (
            <div className="rounded border border-amber-600/70 bg-[#12161c]/95 px-3.5 py-1.5 text-xs font-semibold text-amber-200 shadow-lg">
              {hud.activeEventBanner || toast}
            </div>
          )}
        </div>

        {/* Top-Right Minimap & Menu Buttons */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="grid grid-cols-4 sm:flex sm:flex-wrap sm:justify-end gap-1 rounded-md border border-stone-700/70 bg-[#0d1116]/90 p-1">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenModal('inventory');
              }}
              aria-label="Open Inventory"
              title="Inventory [I]"
              className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded text-stone-200 hover:bg-stone-800 hover:text-amber-400"
            >
              <Backpack className="h-4 w-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenModal('crafting');
              }}
              aria-label="Open Crafting and Base Building"
              title="Craft & Build [B]"
              className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded text-stone-200 hover:bg-stone-800 hover:text-amber-400"
            >
              <Hammer className="h-4 w-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenModal('map');
              }}
              aria-label="Open World Map and Missions"
              title="Map & Missions [M]"
              className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded text-stone-200 hover:bg-stone-800 hover:text-amber-400"
            >
              <Compass className="h-4 w-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenModal('base');
              }}
              aria-label="Open Survivors and Settlement"
              title="Settlement & Survivors [V]"
              className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded text-stone-200 hover:bg-stone-800 hover:text-amber-400"
            >
              <Users className="h-4 w-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenModal('codex');
              }}
              aria-label="Open Zombie Encyclopedia and Achievements"
              title="Encyclopedia [J]"
              className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded text-stone-200 hover:bg-stone-800 hover:text-amber-400"
            >
              <BookOpen className="h-4 w-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleTouch();
              }}
              aria-label="Toggle Touch Controls"
              title="Toggle Touch Controls"
              className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded ${
                touchEnabled ? 'text-amber-400 bg-stone-800' : 'text-stone-300 hover:bg-stone-800'
              }`}
            >
              <Gamepad2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
              title="Mute / Unmute"
              className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded text-stone-200 hover:bg-stone-800"
            >
              {muted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenModal('pause');
              }}
              aria-label="Pause Menu"
              title="Pause [P / Esc]"
              className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-stone-950"
            >
              <Pause className="h-4 w-4" />
            </button>
          </div>

          {/* Radar / Zone Minimap (hidden on very narrow mobile screens to protect viewport) */}
          <div className="hidden sm:block rounded-md border border-stone-700/70 bg-[#0d1116]/90 p-1.5">
            <svg width="88" height="88" viewBox="-100 -100 200 200" aria-label="Zone radar">
              <rect x="-100" y="-100" width="200" height="200" fill="#11161d" />
              <line x1="0" y1="-100" x2="0" y2="100" stroke="#262f3d" strokeWidth="4" />
              <line x1="-100" y1="-14" x2="100" y2="-14" stroke="#262f3d" strokeWidth="4" />
              {WORLD_ZONES.map((z) => (
                <circle
                  key={z.id}
                  cx={z.centerX}
                  cy={z.centerZ}
                  r="8"
                  fill={z.color}
                  fillOpacity="0.45"
                />
              ))}
              <circle cx={hud.playerX} cy={hud.playerZ} r="7" fill="#f8fafc" stroke="#d97706" strokeWidth="3" />
            </svg>
            <div className="mt-1 text-center text-[9px] text-stone-400">
              {getDayPhaseLabel(hud.day)}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Toast / Boss Bar */}
      <div className="flex md:hidden flex-col items-center gap-1.5">
        {hud.activeBoss && (
          <div className="w-full max-w-xs rounded border border-red-700/80 bg-[#140c0e]/92 px-3 py-1.5">
            <div className="flex justify-between text-[11px] font-bold text-red-300">
              <span>{hud.activeBoss.name}</span>
              <span className="font-mono-tabular">{hud.activeBoss.hp}</span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-stone-900 rounded-sm overflow-hidden">
              <div
                className="h-full bg-red-600 origin-left"
                style={{ transform: `scaleX(${Math.max(0, hud.activeBoss.hp / hud.activeBoss.maxHp)})` }}
              />
            </div>
          </div>
        )}
        {(toast || hud.activeEventBanner) && (
          <div className="rounded border border-amber-600/70 bg-[#12161c]/95 px-3 py-1 text-[11px] font-semibold text-amber-200">
            {hud.activeEventBanner || toast}
          </div>
        )}
      </div>

      {/* BOTTOM AREA: Contextual Prompt + Hotbar + Optional Touch Controls */}
      <div className="flex flex-col gap-2">
        {hud.nearbyPrompt && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onInteract}
              className="pointer-events-auto rounded-md border border-amber-500 bg-[#14181f]/95 px-4 py-2 text-xs font-bold text-amber-300 shadow-lg hover:bg-amber-600 hover:text-stone-950 transition-colors"
            >
              {hud.nearbyPrompt}
            </button>
          </div>
        )}

        {/* Compact Hotbar on very narrow screens sits cleanly above touch controls */}
        <div className="flex sm:hidden justify-center">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-stone-700/80 bg-[#0d1116]/92 px-2.5 py-1 shadow-xl">
            <div className="pr-1.5 border-r border-stone-800 text-left">
              <div className="text-[11px] font-bold text-stone-100 leading-tight max-w-[104px] truncate">
                {hud.equippedWeaponName}
              </div>
              <div className="font-mono-tabular text-[10px] text-amber-400">
                {hud.magAmmo}/{hud.reserveAmmo}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onQuickConsume('medicine')}
              className="rounded border border-stone-700 bg-stone-800/90 px-2 py-1 text-[11px] font-semibold text-red-300 active:bg-stone-700 min-h-[32px]"
            >
              Heal
            </button>
            <button
              type="button"
              onClick={() => onQuickConsume('food')}
              className="rounded border border-stone-700 bg-stone-800/90 px-2 py-1 text-[11px] font-semibold text-orange-300 active:bg-stone-700 min-h-[32px]"
            >
              Eat
            </button>
            <button
              type="button"
              onClick={() => onQuickConsume('water')}
              className="rounded border border-stone-700 bg-stone-800/90 px-2 py-1 text-[11px] font-semibold text-sky-300 active:bg-stone-700 min-h-[32px]"
            >
              Drink
            </button>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2">
          {/* Left Virtual Joystick (Mobile / Tablet / Touch Enabled) */}
          {touchEnabled ? (
            <div
              ref={stickRef}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                handleStickPointer(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (e.buttons > 0 || e.pressure > 0) {
                  handleStickPointer(e.clientX, e.clientY);
                }
              }}
              onPointerUp={resetStick}
              onPointerCancel={resetStick}
              style={{ touchAction: 'none' }}
              className="pointer-events-auto relative h-24 w-24 sm:h-28 sm:w-28 rounded-full border-2 border-stone-600/70 bg-[#0d1116]/75 flex items-center justify-center shrink-0"
              aria-label="Movement joystick"
            >
              <div
                className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-amber-500/85 border border-amber-200 shadow-md"
                style={{
                  transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
                }}
              />
            </div>
          ) : (
            <div className="hidden sm:block text-[11px] text-stone-400 bg-[#0d1116]/80 px-2.5 py-1.5 rounded border border-stone-800">
              {hud.isCrouching ? 'STEALTH (CROUCH)' : hud.inVehicle ? `VEHICLE · FUEL ${hud.vehicleFuel}%` : `NOISE ${hud.noiseLevel}dB`}
            </div>
          )}

          {/* Center-Bottom Weapon & Quick-Use Hotbar (Tablet & Desktop) */}
          <div className="hidden sm:flex pointer-events-auto mx-auto flex-wrap items-center justify-center gap-1.5 rounded-md border border-stone-700/80 bg-[#0d1116]/92 px-3 py-1.5 shadow-xl">
            <div className="pr-2 border-r border-stone-800 text-left">
              <div className="text-xs font-bold text-stone-100 leading-tight max-w-[140px] truncate">
                {hud.equippedWeaponName}
              </div>
              <div className="font-mono-tabular text-[11px] text-amber-400">
                {hud.magAmmo} / {hud.reserveAmmo} · {hud.weightKg}/{hud.maxWeightKg}kg
              </div>
            </div>

            <button
              type="button"
              onClick={() => onQuickConsume('medicine')}
              className="rounded border border-stone-700 bg-stone-800/90 px-2.5 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-stone-700 min-h-[36px]"
            >
              Heal
            </button>
            <button
              type="button"
              onClick={() => onQuickConsume('food')}
              className="rounded border border-stone-700 bg-stone-800/90 px-2.5 py-1.5 text-[11px] font-semibold text-orange-300 hover:bg-stone-700 min-h-[36px]"
            >
              Eat
            </button>
            <button
              type="button"
              onClick={() => onQuickConsume('water')}
              className="rounded border border-stone-700 bg-stone-800/90 px-2.5 py-1.5 text-[11px] font-semibold text-sky-300 hover:bg-stone-700 min-h-[36px]"
            >
              Drink
            </button>
          </div>

          {/* Right Thumb Action Cluster (Mobile / Tablet / Touch Enabled) */}
          {touchEnabled ? (
            <div className="pointer-events-auto grid grid-cols-2 gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onReload}
                className="h-10 w-12 sm:h-11 sm:w-12 rounded-md border border-stone-600 bg-[#12161c]/90 text-[11px] font-bold text-stone-200 active:bg-stone-700"
              >
                RLD
              </button>
              <button
                type="button"
                onClick={onCrouch}
                className={`h-10 w-12 sm:h-11 sm:w-12 rounded-md border text-[11px] font-bold ${
                  hud.isCrouching
                    ? 'border-emerald-500 bg-emerald-800/80 text-white'
                    : 'border-stone-600 bg-[#12161c]/90 text-stone-200'
                }`}
              >
                HIDE
              </button>
              <button
                type="button"
                onPointerDown={() => {
                  setSprintHeld(true);
                  onTouchSprint(true);
                }}
                onPointerUp={() => {
                  setSprintHeld(false);
                  onTouchSprint(false);
                }}
                onPointerCancel={() => {
                  setSprintHeld(false);
                  onTouchSprint(false);
                }}
                className={`h-10 w-12 sm:h-11 sm:w-12 rounded-md border text-[11px] font-bold ${
                  sprintHeld
                    ? 'border-amber-400 bg-amber-600 text-stone-950'
                    : 'border-stone-600 bg-[#12161c]/90 text-stone-200'
                }`}
              >
                RUN
              </button>
              <button
                type="button"
                onClick={onAttack}
                className="h-10 w-14 sm:h-12 sm:w-14 rounded-md border border-red-500 bg-red-700/90 text-xs font-extrabold text-white active:bg-red-600 flex items-center justify-center gap-1"
              >
                <Shield className="h-3.5 w-3.5" />
                HIT
              </button>
            </div>
          ) : (
            <div className="hidden sm:block text-[11px] font-mono-tabular text-stone-400 bg-[#0d1116]/80 px-2.5 py-1.5 rounded border border-stone-800">
              SCORE {hud.score}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
