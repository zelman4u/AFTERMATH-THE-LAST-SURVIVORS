import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { ITEMS_CATALOG, PLAYABLE_CHARACTERS } from '../game/data';
import type { CharacterProfile } from '../game/types';

interface Props {
  selectedId: string;
  onSelect: (character: CharacterProfile) => void;
  onClose: () => void;
}

export const CharacterSelectModal: React.FC<Props> = ({ selectedId, onSelect, onClose }) => {
  const [filter, setFilter] = useState<'All' | 'Male' | 'Female'>('All');
  const [inspected, setInspected] = useState<CharacterProfile>(
    PLAYABLE_CHARACTERS.find((c) => c.id === selectedId) ?? PLAYABLE_CHARACTERS[0],
  );

  const filtered = PLAYABLE_CHARACTERS.filter((c) =>
    filter === 'All' ? true : c.gender === filter,
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-3 sm:p-6">
      <div className="flex h-full max-h-[90vh] w-full max-w-6xl flex-col rounded-lg border border-stone-700 bg-[#11151b] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 px-4 py-3 sm:px-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-100">
              Select Survivor (12 Playable Characters)
            </h2>
            <p className="text-xs text-stone-400">
              Each survivor begins with unique history, gear, passive modifiers, and personal missions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded bg-stone-900 p-1">
              {(['All', 'Male', 'Female'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`rounded px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                    filter === tab ? 'bg-amber-600 text-stone-950' : 'text-stone-300 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close character selection"
              className="rounded border border-stone-700 p-2 text-stone-300 hover:bg-stone-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Split */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
          {/* Roster Grid */}
          <div className="lg:col-span-7 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start border-b lg:border-b-0 lg:border-r border-stone-800">
            {filtered.map((char) => {
              const isSelected = char.id === inspected.id;
              return (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => setInspected(char)}
                  className={`text-left rounded-md border p-3 transition-colors ${
                    isSelected
                      ? 'border-amber-500 bg-amber-950/30'
                      : 'border-stone-800 bg-[#171c24] hover:border-stone-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center font-display text-base font-bold text-white"
                        style={{ backgroundColor: char.clothingColor }}
                      >
                        {char.name.split(' ').map((n) => n[0]).join('')}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-stone-100 truncate">
                          {char.name}
                        </div>
                        <div className="text-xs text-stone-400 truncate">
                          {char.title} · {char.gender}, {char.age}
                        </div>
                      </div>
                    </div>
                    {selectedId === char.id && (
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    )}
                  </div>
                  <div className="mt-2 text-xs text-stone-300 line-clamp-2">{char.specialty}</div>
                </button>
              );
            })}
          </div>

          {/* Detailed Bio Inspector */}
          <div className="lg:col-span-5 p-5 flex flex-col justify-between bg-[#0e1217] space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-14 w-14 rounded-lg flex items-center justify-center font-display text-2xl font-bold text-white border border-white/15 shrink-0"
                  style={{ backgroundColor: inspected.clothingColor }}
                >
                  {inspected.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-stone-100">
                    {inspected.name}
                  </h3>
                  <div className="text-xs text-amber-400 font-medium">
                    {inspected.occupation} · Age {inspected.age} · {inspected.gender}
                  </div>
                </div>
              </div>

              <p className="text-xs italic text-stone-400">{inspected.quote}</p>

              <div className="space-y-2 text-xs text-stone-300 leading-relaxed">
                <div>
                  <span className="font-semibold text-stone-100">History: </span>
                  {inspected.history}
                </div>
                <div>
                  <span className="font-semibold text-stone-100">Family: </span>
                  {inspected.familyBackground}
                </div>
                <div>
                  <span className="font-semibold text-stone-100">Day 1 Survival: </span>
                  {inspected.outbreakSurvival}
                </div>
                <div>
                  <span className="font-semibold text-stone-100">Personality: </span>
                  {inspected.personality}
                </div>
                <div>
                  <span className="font-semibold text-emerald-400">Specialty: </span>
                  {inspected.specialty}
                </div>
                <div>
                  <span className="font-semibold text-red-400">Weakness: </span>
                  {inspected.weakness}
                </div>
              </div>

              <div className="rounded border border-stone-800 bg-stone-900/70 p-3">
                <div className="text-xs font-semibold text-amber-400">
                  Personal Mission: {inspected.personalMissionTitle}
                </div>
                <div className="text-xs text-stone-300 mt-1">{inspected.personalMissionDesc}</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-stone-200 mb-1.5">Starting Equipment</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-400">
                  {inspected.startingItems.map((it) => (
                    <span key={it.itemId}>
                      {ITEMS_CATALOG[it.itemId]?.name ?? it.itemId} ×{it.qty}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onSelect(inspected);
                onClose();
              }}
              className="w-full rounded-md bg-amber-600 hover:bg-amber-500 py-3 text-sm font-bold text-stone-950 transition-colors"
            >
              Play as {inspected.name}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
