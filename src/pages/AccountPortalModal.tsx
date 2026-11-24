import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { Database, LogIn, LogOut, Save, UserCircle2, X } from 'lucide-react';
import type { GameSaveRecord } from '../game/types';
import { AdminDashboard } from './AdminDashboard';
import { Dashboard } from './Dashboard';
import { Profile } from './Profile';

export type PortalTab = 'saves' | 'profile' | 'admin';

interface Props {
  user: User | null;
  authLoading: boolean;
  currentSave: GameSaveRecord;
  initialTab?: PortalTab;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
  onLoadSaveIntoWorld: (loaded: GameSaveRecord) => void;
  onNotify: (msg: string) => void;
  onClose: () => void;
}

export const AccountPortalModal: React.FC<Props> = ({
  user,
  authLoading,
  currentSave,
  initialTab = 'saves',
  onGoogleSignIn,
  onSignOut,
  onLoadSaveIntoWorld,
  onNotify,
  onClose,
}) => {
  const [tab, setTab] = useState<PortalTab>(initialTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-6">
      <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border border-stone-700 bg-[#101419] shadow-2xl overflow-hidden">
        {/* Top Portal Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 px-3 py-2.5 sm:px-5 bg-[#0c0f13]">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setTab('saves')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                tab === 'saves'
                  ? 'bg-amber-600 text-stone-950'
                  : 'text-stone-300 hover:bg-stone-800'
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              Save Slots & Backups
            </button>
            <button
              type="button"
              onClick={() => setTab('profile')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                tab === 'profile'
                  ? 'bg-amber-600 text-stone-950'
                  : 'text-stone-300 hover:bg-stone-800'
              }`}
            >
              <UserCircle2 className="h-3.5 w-3.5" />
              Survivor Profile
            </button>
            <button
              type="button"
              onClick={() => setTab('admin')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                tab === 'admin'
                  ? 'bg-amber-600 text-stone-950'
                  : 'text-stone-300 hover:bg-stone-800'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              Admin & Database
            </button>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-1 rounded border border-stone-700 px-2.5 py-1.5 text-xs text-stone-300 hover:bg-stone-800 whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                disabled={authLoading}
                onClick={onGoogleSignIn}
                className="flex items-center gap-1.5 rounded bg-stone-100 hover:bg-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-900 whitespace-nowrap"
              >
                <LogIn className="h-3.5 w-3.5 text-red-600" />
                {authLoading ? 'Connecting...' : 'Sign in with Google'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Account Portal"
              className="rounded border border-stone-700 p-1.5 text-stone-300 hover:bg-stone-800 shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {tab === 'saves' && (
            <Dashboard
              user={user}
              currentSave={currentSave}
              onLoadSaveIntoWorld={(loaded) => {
                onLoadSaveIntoWorld(loaded);
                onClose();
              }}
              onNotify={onNotify}
            />
          )}
          {tab === 'profile' && (
            <Profile user={user} activeCharacterId={currentSave.characterId} />
          )}
          {tab === 'admin' && <AdminDashboard user={user} />}
        </div>
      </div>
    </div>
  );
};
