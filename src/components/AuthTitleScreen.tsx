import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  LogIn,
  LogOut,
  Play,
  RotateCcw,
  ShieldAlert,
  Users,
  CheckCircle2,
  FileText,
  Database,
} from 'lucide-react';
import type { CharacterProfile, DifficultyLevel, GameMode, GameSaveRecord } from '../game/types';

interface Props {
  user: User | null;
  authLoading: boolean;
  authMessage: string | null;
  selectedCharacter: CharacterProfile;
  existingSave: GameSaveRecord | null;
  mode: GameMode;
  difficulty: DifficultyLevel;
  onChangeMode: (m: GameMode) => void;
  onChangeDifficulty: (d: DifficultyLevel) => void;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
  onOpenCharacters: () => void;
  onOpenPortal: () => void;
  onStartNewGame: () => void;
  onContinueGame: () => void;
}

export const AuthTitleScreen: React.FC<Props> = ({
  user,
  authLoading,
  authMessage,
  selectedCharacter,
  existingSave,
  mode,
  difficulty,
  onChangeMode,
  onChangeDifficulty,
  onGoogleSignIn,
  onSignOut,
  onOpenCharacters,
  onOpenPortal,
  onStartNewGame,
  onContinueGame,
}) => {
  const [showLegal, setShowLegal] = useState(false);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between overflow-y-auto p-4 sm:p-8 bg-gradient-to-r from-[#090b0e]/95 via-[#090b0e]/75 to-transparent">
      {/* Top Account Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-medium text-stone-400">
          Cross-Platform 3D Survival · Phone · Tablet · Laptop · Desktop
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenPortal}
            className="flex items-center gap-1.5 rounded-md border border-stone-700 bg-[#12161c]/95 px-3 py-2 text-xs font-semibold text-stone-200 hover:border-amber-500 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
          >
            <Database className="h-3.5 w-3.5 text-amber-500" />
            Save Slots & Portal
          </button>

          {user ? (
            <div className="flex items-center gap-3 rounded-md border border-stone-700/70 bg-[#12161c]/95 px-3 py-1.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Player avatar'}
                  referrerPolicy="no-referrer"
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              )}
              <div className="text-xs">
                <div className="font-semibold text-stone-100 leading-tight">
                  {user.displayName || 'Survivor'}
                </div>
                <div className="text-[11px] text-stone-400 leading-tight">{user.email}</div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="ml-1 flex items-center gap-1 rounded border border-stone-700 px-2 py-1 text-xs text-stone-300 hover:bg-stone-800 whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={authLoading}
              onClick={onGoogleSignIn}
              className="flex items-center gap-2 rounded-md border border-stone-600 bg-[#f8fafc] px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-stone-200 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <LogIn className="h-4 w-4 text-red-600" />
              {authLoading ? 'Connecting...' : 'Sign in with Google'}
            </button>
          )}
        </div>
      </div>

      {/* Main Left-Aligned Title & Launch Panel */}
      <div className="my-auto w-full max-w-xl py-4">
        {/* Custom Inline SVG Title Emblem */}
        <div className="mb-4">
          <svg
            viewBox="0 0 520 110"
            className="w-full max-w-md h-auto"
            role="img"
            aria-label="AFTERMATH: The Last Survivors"
          >
            <rect x="0" y="8" width="6" height="92" fill="#d97706" />
            <text
              x="20"
              y="62"
              fill="#f8fafc"
              fontFamily="'Barlow Condensed', sans-serif"
              fontWeight="800"
              fontSize="64"
              letterSpacing="3"
            >
              AFTERMATH
            </text>
            <text
              x="22"
              y="94"
              fill="#f59e0b"
              fontFamily="'Barlow Condensed', sans-serif"
              fontWeight="700"
              fontSize="26"
              letterSpacing="6"
            >
              THE LAST SURVIVORS
            </text>
          </svg>
        </div>

        <p className="max-w-lg text-sm sm:text-base text-stone-300 leading-relaxed mb-5">
          Scavenge nine infected zones, manage hunger, hydration, warmth, and wounds, fortify your shelter, recruit survivors, and survive beyond Day 100.
        </p>

        {authMessage && (
          <div className="mb-4 flex items-center gap-2 rounded border border-amber-700/60 bg-amber-950/70 px-3 py-2 text-xs text-amber-200">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{authMessage}</span>
          </div>
        )}

        {/* Control Deck */}
        <div className="rounded-lg border border-stone-800 bg-[#11151b]/95 p-4 sm:p-5 shadow-2xl space-y-4">
          {/* Selected Character Summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-3">
            <div>
              <div className="text-xs text-stone-400">
                Selected Survivor · {selectedCharacter.gender} · Age {selectedCharacter.age}
              </div>
              <div className="font-display text-2xl font-bold text-stone-100">
                {selectedCharacter.name} — <span className="text-amber-500">{selectedCharacter.title}</span>
              </div>
              <div className="text-xs text-stone-400 mt-0.5">{selectedCharacter.specialty}</div>
            </div>
            <button
              type="button"
              onClick={onOpenCharacters}
              className="flex items-center gap-2 rounded-md border border-stone-700 bg-stone-800/90 px-3.5 py-2 text-xs font-semibold text-stone-100 hover:border-amber-500 hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Users className="h-4 w-4 text-amber-500" />
              Roster (12)
            </button>
          </div>

          {/* Mode & Difficulty Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="block text-xs font-medium text-stone-400 mb-1.5">Game Mode</span>
              <div className="grid grid-cols-2 gap-1 rounded bg-stone-900 p-1">
                {(['story', 'endless'] as GameMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onChangeMode(m)}
                    className={`rounded px-2.5 py-1.5 text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                      mode === m
                        ? 'bg-amber-600 text-stone-950'
                        : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    {m === 'story' ? 'Story Mode' : 'Endless'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-stone-400 mb-1.5">Difficulty</span>
              <div className="grid grid-cols-3 gap-1 rounded bg-stone-900 p-1">
                {(['normal', 'hard', 'nightmare'] as DifficultyLevel[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onChangeDifficulty(d)}
                    className={`rounded px-2 py-1.5 text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                      difficulty === d
                        ? 'bg-red-600 text-white'
                        : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            {existingSave && (
              <button
                type="button"
                onClick={onContinueGame}
                className="flex-1 flex items-center justify-center gap-2 rounded-md border border-emerald-600/70 bg-emerald-700 hover:bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" />
                Continue (Day {existingSave.day})
              </button>
            )}

            <button
              type="button"
              data-start="true"
              onClick={onStartNewGame}
              className="flex-1 flex items-center justify-center gap-2 rounded-md bg-amber-600 hover:bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 transition-colors whitespace-nowrap"
            >
              <Play className="h-4 w-4 fill-current" />
              {existingSave ? 'Start New Survival' : 'Enter Outbreak (Day 1)'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Control Hint & Legal */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-400">
        <div>
          WASD / Touch Stick Move · Click / Space Attack · E Scavenge & Interact · R Reload · I Bag · B Craft · M Map
        </div>
        <button
          type="button"
          onClick={() => setShowLegal(true)}
          className="flex items-center gap-1 text-stone-400 hover:text-stone-200 underline-offset-4 hover:underline whitespace-nowrap shrink-0"
        >
          <FileText className="h-3.5 w-3.5" />
          Account Privacy & Save Terms
        </button>
      </div>

      {showLegal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-lg border border-stone-700 bg-[#14181f] p-5 text-sm text-stone-300 space-y-3">
            <h3 className="font-display text-xl font-bold text-stone-100">
              Google Cloud Save & Privacy
            </h3>
            <p className="text-xs leading-relaxed text-stone-300">
              Signing in with Google uses official Firebase Authentication. Your Gmail password is never requested or stored. Save data (selected character, inventory, base structures, day progress, and unlocked achievements) is stored securely under your private user ID in Cloud Firestore so you can resume across phones, tablets, laptops, and desktops.
            </p>
            <button
              type="button"
              onClick={() => setShowLegal(false)}
              className="w-full rounded bg-amber-600 py-2 text-xs font-bold text-stone-950 hover:bg-amber-500"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
