import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { Database, Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  fetchAdminOverview,
  fetchAuthStatus,
  fetchWorldHealth,
  type AdminOverviewResponse,
} from '../services/api';

interface Props {
  user: User | null;
}

const SCHEMA_COLLECTIONS = [
  'users',
  'players',
  'characters',
  'inventories',
  'weapons',
  'armor',
  'craftingrecipes',
  'bases',
  'worlds',
  'quests',
  'zombies',
  'bosses',
  'gamesaves',
  'achievements',
];

export const AdminDashboard: React.FC<Props> = ({ user }) => {
  const [adminData, setAdminData] = useState<AdminOverviewResponse | null>(null);
  const [health, setHealth] = useState<{
    databaseMode: string;
    collections: number;
    totalSaves: number;
  } | null>(null);
  const [forbiddenMsg, setForbiddenMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const h = await fetchWorldHealth();
      setHealth(h);
    } catch {
      // ignore
    }
    try {
      const status = await fetchAuthStatus();
      if (!status.authenticated || !status.isAdmin) {
        setAdminData(null);
        setForbiddenMsg(
          status.authenticated
            ? 'Signed-in account does not hold administrator privileges.'
            : 'Sign in with the verified administrator Google account to view global telemetry.',
        );
        return;
      }
      const data = await fetchAdminOverview();
      setAdminData(data);
      setForbiddenMsg(null);
    } catch (err) {
      setAdminData(null);
      setForbiddenMsg(
        err instanceof Error
          ? err.message
          : 'Admin dashboard requires verified Google Admin authentication.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-800 bg-[#151a21] p-4">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-amber-500" />
          <div>
            <div className="font-display text-xl font-bold text-stone-100">
              Server & 14-Collection Database Console
            </div>
            <div className="text-xs text-stone-400">
              Engine: {health?.databaseMode || 'Checking...'} · {health?.collections ?? 14} Schemas ·{' '}
              {health?.totalSaves ?? 0} Active Saves
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="flex items-center gap-1.5 rounded border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-200 hover:bg-stone-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* 14-Collection Architecture Overview */}
      <div className="rounded-md border border-stone-800 bg-[#151a21] p-4 space-y-2.5">
        <div className="text-xs font-semibold uppercase tracking-wider text-stone-300">
          Configured Document Collections (14)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(adminData?.collections || SCHEMA_COLLECTIONS).map((col) => (
            <span
              key={col}
              className="rounded border border-stone-700 bg-stone-900 px-2.5 py-1 font-mono-tabular text-[11px] text-amber-300"
            >
              {col}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-stone-400">Verifying admin privileges...</div>
      ) : adminData ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded border border-stone-800 bg-[#151a21] p-3">
              <div className="text-xs text-stone-400">Registered Users</div>
              <div className="font-mono-tabular text-2xl font-bold text-stone-100">
                {adminData.counts.users}
              </div>
            </div>
            <div className="rounded border border-stone-800 bg-[#151a21] p-3">
              <div className="text-xs text-stone-400">Player Records</div>
              <div className="font-mono-tabular text-2xl font-bold text-emerald-400">
                {adminData.counts.players}
              </div>
            </div>
            <div className="rounded border border-stone-800 bg-[#151a21] p-3">
              <div className="text-xs text-stone-400">Total Save Slots</div>
              <div className="font-mono-tabular text-2xl font-bold text-amber-400">
                {adminData.counts.saves}
              </div>
            </div>
            <div className="rounded border border-stone-800 bg-[#151a21] p-3">
              <div className="text-xs text-stone-400">Backup Snapshots</div>
              <div className="font-mono-tabular text-2xl font-bold text-sky-400">
                {adminData.counts.backups}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-stone-800 bg-[#151a21] p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Anti-Cheat & Save Validation Audit Stream
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {adminData.auditLogs.length === 0 ? (
                <div className="text-xs text-stone-500">No audit events recorded yet.</div>
              ) : (
                adminData.auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-stone-800 bg-stone-900/80 px-3 py-1.5 text-xs"
                  >
                    <div>
                      <span
                        className={`font-semibold ${
                          log.status === 'rejected' ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        [{log.status.toUpperCase()}]
                      </span>{' '}
                      <span className="text-stone-200">{log.action}</span>{' '}
                      <span className="text-stone-400">— {log.detail}</span>
                    </div>
                    <span className="text-[11px] text-stone-500">
                      {new Date(log.timestampIso).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-md border border-amber-800/60 bg-amber-950/30 p-4 text-xs text-amber-200">
          <Lock className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-sm text-amber-300">
              Admin Telemetry Restricted
            </div>
            <p className="text-stone-300 leading-relaxed">
              {forbiddenMsg ||
                'Sign in with the verified administrator Google account to inspect global player counts, user records, and anti-cheat audit logs.'}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400 pt-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              Admin authorization is verified server-side via cryptographic Google Firebase ID token signatures.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
