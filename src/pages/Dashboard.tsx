import React, { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Clock,
  HardDriveDownload,
  History,
  Play,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { PLAYABLE_CHARACTERS } from '../game/data';
import type { GameSaveRecord } from '../game/types';
import {
  deleteSaveSlotApi,
  fetchSaveSlots,
  fetchSlotBackups,
  restoreSlotBackup,
  type SaveBackupSnapshot,
  type SaveSlotId,
  type SaveSlotSummary,
} from '../services/api';
import { saveCloudProgress } from '../services/saveService';

interface Props {
  user: User | null;
  currentSave: GameSaveRecord;
  onLoadSaveIntoWorld: (loaded: GameSaveRecord) => void;
  onNotify: (msg: string) => void;
}

const SLOTS: { id: SaveSlotId; label: string; description: string }[] = [
  { id: 'active', label: 'Active Auto-Save', description: 'Live cross-device progression slot' },
  { id: 'slot_1', label: 'Manual Slot 1', description: 'Dedicated campaign checkpoint 1' },
  { id: 'slot_2', label: 'Manual Slot 2', description: 'Dedicated campaign checkpoint 2' },
  { id: 'slot_3', label: 'Manual Slot 3', description: 'Dedicated campaign checkpoint 3' },
];

export const Dashboard: React.FC<Props> = ({
  user,
  currentSave,
  onLoadSaveIntoWorld,
  onNotify,
}) => {
  const [slots, setSlots] = useState<SaveSlotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [selectedHistorySlot, setSelectedHistorySlot] = useState<SaveSlotId>('active');
  const [backups, setBackups] = useState<SaveBackupSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const refreshSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSaveSlots();
      setSlots(res.slots);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to fetch save slots.');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  const loadHistory = useCallback(async (slotId: SaveSlotId) => {
    setSelectedHistorySlot(slotId);
    setHistoryLoading(true);
    try {
      const res = await fetchSlotBackups(slotId);
      setBackups(res.backups);
    } catch {
      setBackups([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSlots();
    loadHistory('active');
  }, [refreshSlots, loadHistory, user]);

  const handleSaveToSlot = async (slotId: SaveSlotId) => {
    setBusySlot(slotId);
    try {
      const res = await saveCloudProgress(user, currentSave, slotId, 'manual');
      await refreshSlots();
      await loadHistory(slotId);
      onNotify(
        res.savedToCloud
          ? `Saved Day ${currentSave.day} to ${slotId} (Google Cloud + Server Backup).`
          : `Saved Day ${currentSave.day} to ${slotId} on Server + Local Storage.`,
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save slot.');
    } finally {
      setBusySlot(null);
    }
  };

  const handleRestoreBackup = async (backup: SaveBackupSnapshot) => {
    setBusySlot(backup.backupId);
    try {
      const res = await restoreSlotBackup(backup.saveId as SaveSlotId, backup.backupId);
      if (res.ok && res.save) {
        await refreshSlots();
        await loadHistory(backup.saveId as SaveSlotId);
        onLoadSaveIntoWorld(res.save);
        onNotify(`Restored Day ${res.save.day} snapshot from ${backup.saveId}.`);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to restore backup snapshot.');
    } finally {
      setBusySlot(null);
    }
  };

  const handleDeleteSlot = async (slotId: SaveSlotId) => {
    setBusySlot(slotId);
    try {
      await deleteSaveSlotApi(slotId);
      await refreshSlots();
      if (selectedHistorySlot === slotId) {
        setBackups([]);
      }
      onNotify(`Cleared ${slotId}.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to clear slot.');
    } finally {
      setBusySlot(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Multi-slot grid */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-xl font-bold text-stone-100">
              Multi-Slot Cloud & Server Saves
            </h3>
            <p className="text-xs text-stone-400">
              Each save automatically rotates up to 10 encrypted server backup snapshots to protect your survival progress.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshSlots}
            className="flex items-center gap-1.5 rounded border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-200 hover:bg-stone-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Refresh Slots
          </button>
        </div>

        {loading ? (
          <div className="text-xs text-stone-400">Loading save slots...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SLOTS.map((slotMeta) => {
              const found = slots.find((s) => s.saveId === slotMeta.id);
              const charName = found
                ? PLAYABLE_CHARACTERS.find((c) => c.id === found.characterId)?.name ??
                  found.characterId
                : null;
              return (
                <div
                  key={slotMeta.id}
                  className="flex flex-col justify-between rounded-md border border-stone-800 bg-[#151a21] p-4 space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-stone-100">
                        {slotMeta.label}
                      </span>
                      <span className="text-[11px] font-mono-tabular text-amber-400">
                        {found ? `v${found.version} · ${found.backupsCount} backups` : 'Empty'}
                      </span>
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5">{slotMeta.description}</div>

                    {found ? (
                      <div className="mt-3 rounded bg-stone-900/90 p-2.5 text-xs space-y-1">
                        <div className="font-semibold text-stone-200">
                          {charName} · Day {found.day} ({found.difficulty.toUpperCase()})
                        </div>
                        <div className="text-[11px] text-stone-400 flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {new Date(found.updatedAtIso).toLocaleString()}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono-tabular">
                          Kills {found.payload.zombieKills} · Score {found.payload.score}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded border border-dashed border-stone-800 p-3 text-center text-xs text-stone-500">
                        No save stored in this slot yet
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busySlot === slotMeta.id}
                      onClick={() => handleSaveToSlot(slotMeta.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-xs font-bold text-stone-950 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save Here
                    </button>

                    {found && (
                      <>
                        <button
                          type="button"
                          onClick={() => onLoadSaveIntoWorld(found)}
                          className="flex items-center justify-center gap-1.5 rounded bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => loadHistory(slotMeta.id)}
                          className="flex items-center justify-center gap-1 rounded border border-stone-700 bg-stone-800 hover:bg-stone-700 px-2.5 py-1.5 text-xs font-semibold text-stone-200"
                          title="Inspect Backup Snapshots"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busySlot === slotMeta.id}
                          onClick={() => handleDeleteSlot(slotMeta.id)}
                          aria-label={`Delete ${slotMeta.label}`}
                          className="flex items-center justify-center rounded border border-red-900/60 bg-red-950/40 hover:bg-red-900/60 px-2.5 py-1.5 text-xs text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Backup Snapshot History */}
      <div className="rounded-md border border-stone-800 bg-[#151a21] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HardDriveDownload className="h-4 w-4 text-amber-500" />
            <h4 className="font-display text-lg font-bold text-stone-100">
              Backup Snapshot Recovery ({selectedHistorySlot})
            </h4>
          </div>
          <div className="flex gap-1">
            {SLOTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loadHistory(s.id)}
                className={`rounded px-2.5 py-1 text-[11px] font-semibold ${
                  selectedHistorySlot === s.id
                    ? 'bg-amber-600 text-stone-950'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                {s.id}
              </button>
            ))}
          </div>
        </div>

        {historyLoading ? (
          <div className="text-xs text-stone-400">Loading snapshots...</div>
        ) : backups.length === 0 ? (
          <div className="text-xs text-stone-500">
            No previous backups rotated for {selectedHistorySlot} yet. Overwriting a slot creates an automatic restore point.
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {backups.map((b) => (
              <div
                key={b.backupId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-stone-800 bg-stone-900/80 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-semibold text-stone-200">
                    Day {b.day} · v{b.version}
                  </span>{' '}
                  <span className="text-stone-400">
                    ({b.reason}) · Zone {b.zoneId} · {new Date(b.createdAtIso).toLocaleString()}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busySlot === b.backupId}
                  onClick={() => handleRestoreBackup(b)}
                  className="rounded border border-emerald-700/70 bg-emerald-800/70 hover:bg-emerald-700 px-3 py-1 text-[11px] font-semibold text-white"
                >
                  Restore Snapshot
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
