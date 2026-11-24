import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { Award, ShieldCheck, Skull, Trophy, UserCircle2 } from 'lucide-react';
import { ACHIEVEMENTS_LIST, PLAYABLE_CHARACTERS } from '../game/data';
import {
  fetchPlayerProfile,
  getPersistentGuestId,
  type PlayerProfileSummary,
} from '../services/api';

interface Props {
  user: User | null;
  activeCharacterId: string;
}

export const Profile: React.FC<Props> = ({ user, activeCharacterId }) => {
  const [profile, setProfile] = useState<PlayerProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPlayerProfile()
      .then((res) => {
        if (!alive) return;
        setProfile(res.player);
        setError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Could not load profile.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const char =
    PLAYABLE_CHARACTERS.find((c) => c.id === (profile?.activeCharacterId || activeCharacterId)) ??
    PLAYABLE_CHARACTERS[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-stone-800 bg-[#151a21] p-4">
        <div className="flex items-center gap-3">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Player'}
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-full object-cover border border-amber-600/60"
            />
          ) : (
            <UserCircle2 className="h-12 w-12 text-amber-500" />
          )}
          <div>
            <div className="font-display text-2xl font-bold text-stone-100">
              {user?.displayName || 'Offline / Guest Survivor'}
            </div>
            <div className="text-xs text-stone-400">
              {user?.email || `Local Profile ID: ${getPersistentGuestId()}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded border border-emerald-700/50 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-300">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {user ? 'Google Cloud + Server Sync Active' : 'Local & Server Slot Sync Active'}
        </div>
      </div>

      {loading && <div className="text-xs text-stone-400">Loading survivor profile...</div>}
      {error && (
        <div className="rounded border border-red-800/60 bg-red-950/40 p-3 text-xs text-red-200">
          {error}
        </div>
      )}

      {profile && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-md border border-stone-800 bg-[#151a21] p-4">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>Highest Survival Day</span>
                <Trophy className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-1 font-mono-tabular text-3xl font-bold text-stone-100">
                Day {profile.highestDay}
              </div>
            </div>
            <div className="rounded-md border border-stone-800 bg-[#151a21] p-4">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>Total Infected Eliminated</span>
                <Skull className="h-4 w-4 text-red-400" />
              </div>
              <div className="mt-1 font-mono-tabular text-3xl font-bold text-amber-400">
                {profile.totalZombieKills}
              </div>
            </div>
            <div className="rounded-md border border-stone-800 bg-[#151a21] p-4">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>Lifetime Survival Score</span>
                <Award className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-1 font-mono-tabular text-3xl font-bold text-emerald-400">
                {profile.totalScore}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-stone-800 bg-[#151a21] p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-500">
              Active Character Dossier
            </div>
            <div className="font-display text-xl font-bold text-stone-100">
              {char.name} · {char.title}
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">{char.history}</p>
            <div className="text-xs text-stone-400">Specialty: {char.specialty}</div>
          </div>

          <div className="rounded-md border border-stone-800 bg-[#151a21] p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-300">
              Unlocked Achievements ({profile.unlockedAchievements.length} /{' '}
              {ACHIEVEMENTS_LIST.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ACHIEVEMENTS_LIST.map((ach) => {
                const unlocked = profile.unlockedAchievements.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`rounded border px-3 py-2 text-xs ${
                      unlocked
                        ? 'border-amber-600/60 bg-amber-950/20 text-stone-100'
                        : 'border-stone-800 bg-stone-900/60 text-stone-500'
                    }`}
                  >
                    <div className="font-semibold">{ach.title}</div>
                    <div className="text-[11px]">{ach.rewardTitle}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
