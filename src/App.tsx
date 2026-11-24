import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AuthTitleScreen } from './components/AuthTitleScreen';
import { CharacterSelectModal } from './components/CharacterSelectModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GameModals } from './components/GameModals';
import { SurvivalHUD, type ActiveModalTab } from './components/SurvivalHUD';
import { auth, testConnection } from './firebase';
import { soundEngine } from './game/audio';
import { ITEMS_CATALOG, PLAYABLE_CHARACTERS } from './game/data';
import {
  consumeItem,
  createInitialSaveRecord,
  getCharacterById,
} from './game/simulation';
import type {
  CharacterProfile,
  DifficultyLevel,
  GameMode,
  GameSaveRecord,
  GameScreenState,
  HudSnapshot,
} from './game/types';
import { WorldEngine } from './game/WorldEngine';
import { AccountPortalModal } from './pages/AccountPortalModal';
import { flushOfflineSaveQueue, getPersistentGuestId } from './services/api';
import {
  ensureUserProfile,
  loadCloudProgress,
  loadLocalBackup,
  saveCloudProgress,
  saveLocalBackup,
  signInWithGoogleAccount,
  signOutAccount,
} from './services/saveService';

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth < 1024
  );
}

function createInitialHud(save: GameSaveRecord): HudSnapshot {
  const wDef = ITEMS_CATALOG[save.payload.equippedWeaponId] ?? ITEMS_CATALOG.kitchen_knife;
  return {
    stats: save.payload.stats,
    day: save.day,
    timeOfDay: save.timeOfDay,
    weather: save.weather,
    zoneName: 'Safe Haven Outpost',
    zoneId: 'safehouse',
    equippedWeaponId: save.payload.equippedWeaponId,
    equippedWeaponName: wDef.name,
    magAmmo: save.payload.ammoInMag[save.payload.equippedWeaponId] ?? 0,
    reserveAmmo: 0,
    weightKg: 4,
    maxWeightKg: ITEMS_CATALOG[save.payload.equippedBackpackId]?.backpackBonusKg ?? 25,
    zombieKills: save.payload.zombieKills,
    score: save.payload.score,
    nearbyPrompt: null,
    nearbyTargetType: null,
    activeBoss: null,
    inVehicle: false,
    vehicleFuel: save.payload.vehicleFuel,
    noiseLevel: 0,
    isCrouching: false,
    playerX: save.payload.position.x,
    playerZ: save.payload.position.z,
    activeEventBanner: null,
  };
}

function GameShell() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<WorldEngine | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const [selectedCharId, setSelectedCharId] = useState<string>(PLAYABLE_CHARACTERS[0].id);
  const [mode, setMode] = useState<GameMode>('story');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('normal');

  const initialSave = useMemo(
    () =>
      createInitialSaveRecord({
        ownerId: 'guest_local',
        characterId: PLAYABLE_CHARACTERS[0].id,
        mode: 'story',
        difficulty: 'normal',
      }),
    [],
  );

  const [save, setSave] = useState<GameSaveRecord>(initialSave);
  const [existingSave, setExistingSave] = useState<GameSaveRecord | null>(() =>
    loadLocalBackup('guest_local'),
  );
  const [screenState, setScreenState] = useState<GameScreenState>('title');
  const [hud, setHud] = useState<HudSnapshot>(() => createInitialHud(initialSave));

  const [showCharSelect, setShowCharSelect] = useState(false);
  const [showPortal, setShowPortal] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveModalTab>(null);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [muted, setMuted] = useState(false);
  const manualTouchOverrideRef = useRef(false);
  const [touchEnabled, setTouchEnabled] = useState<boolean>(() => detectTouchDevice());
  const [toast, setToast] = useState<string | null>(null);

  // Refs so WorldEngine callbacks always access latest React state/handlers cleanly
  const userRef = useRef<User | null>(user);
  userRef.current = user;
  const screenStateRef = useRef<GameScreenState>(screenState);
  screenStateRef.current = screenState;
  const activeTabRef = useRef<ActiveModalTab>(activeTab);
  activeTabRef.current = activeTab;
  const showCharSelectRef = useRef<boolean>(showCharSelect);
  showCharSelectRef.current = showCharSelect;
  const showPortalRef = useRef<boolean>(showPortal);
  showPortalRef.current = showPortal;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3600);
  }, []);

  const persistProgress = useCallback(
    async (record: GameSaveRecord, syncCloud = false) => {
      saveLocalBackup(record);
      setExistingSave(record);
      if (syncCloud && userRef.current) {
        setCloudSaving(true);
        try {
          await saveCloudProgress(userRef.current, record);
        } catch (err) {
          console.error('Cloud save failed:', err);
        } finally {
          setCloudSaving(false);
        }
      }
    },
    [],
  );

  // Auto-sync touch controls & flush queued offline saves on reconnect
  useEffect(() => {
    const onResize = () => {
      if (!manualTouchOverrideRef.current) {
        setTouchEnabled(detectTouchDevice());
      }
    };
    const onOnline = () => {
      flushOfflineSaveQueue()
        .then((n) => {
          if (n > 0) showToast(`Synced ${n} offline save(s) to server.`);
        })
        .catch(() => {});
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('online', onOnline);
    onOnline();
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('online', onOnline);
    };
  }, [showToast]);

  // Check Firestore connection & subscribe to Firebase Auth state
  useEffect(() => {
    testConnection().catch(() => {});
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          await ensureUserProfile(firebaseUser);
          const cloudSave = await loadCloudProgress(firebaseUser);
          if (cloudSave) {
            setExistingSave(cloudSave);
            setSelectedCharId(cloudSave.characterId);
            setMode(cloudSave.mode);
            setDifficulty(cloudSave.difficulty);
          } else {
            const guestBackup = loadLocalBackup('guest_local');
            if (guestBackup) setExistingSave(guestBackup);
          }
          setAuthMessage(null);
        } catch (err) {
          console.error('Auth profile sync error:', err);
          setAuthMessage('Signed in locally. Cloud sync will retry automatically.');
        }
      } else {
        setExistingSave(loadLocalBackup('guest_local'));
      }
    });
    return () => unsub();
  }, []);

  // Mount Three.js WorldEngine ONCE
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new WorldEngine(mount, initialSave, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onSaveChanged: (nextSave, triggerAutoSave) => {
        setSave(nextSave);
        persistProgress(nextSave, Boolean(triggerAutoSave));
      },
      onGameOver: (finalSave) => {
        setSave(finalSave);
        setActiveTab(null);
        setScreenState('gameover');
        persistProgress(finalSave, true);
      },
      onToast: (msg) => {
        showToast(msg);
      },
    });

    engineRef.current = engine;

    // Support ?autostart=1 for immediate gameplay entry
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.setGameState('playing');
      setScreenState('playing');
    } else {
      engine.setGameState('title');
      setScreenState('title');
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, [initialSave, persistProgress, showToast]);

  const handleStartNewGame = useCallback(() => {
    const fresh = createInitialSaveRecord({
      ownerId: userRef.current?.uid || getPersistentGuestId(),
      characterId: selectedCharId,
      mode,
      difficulty,
    });
    setSave(fresh);
    setActiveTab(null);
    setShowCharSelect(false);
    setShowPortal(false);
    setScreenState('playing');
    engineRef.current?.syncWorldFromSave(fresh);
    engineRef.current?.setGameState('playing');
    persistProgress(fresh, true);
    const char = getCharacterById(selectedCharId);
    showToast(`${char.name} entered Day 1 Outbreak.`);
  }, [selectedCharId, mode, difficulty, persistProgress, showToast]);

  const handleLoadSaveIntoWorld = useCallback(
    (loaded: GameSaveRecord) => {
      const resumed: GameSaveRecord = {
        ...loaded,
        ownerId: userRef.current?.uid || loaded.ownerId,
      };
      setSave(resumed);
      setExistingSave(resumed);
      setSelectedCharId(resumed.characterId);
      setMode(resumed.mode);
      setDifficulty(resumed.difficulty);
      setActiveTab(null);
      setShowCharSelect(false);
      setShowPortal(false);
      setScreenState('playing');
      engineRef.current?.syncWorldFromSave(resumed);
      engineRef.current?.setGameState('playing');
      showToast(`Loaded Day ${resumed.day} (${resumed.saveId}).`);
    },
    [showToast],
  );

  const handleContinueGame = useCallback(() => {
    const target = existingSave;
    if (!target) {
      handleStartNewGame();
      return;
    }
    handleLoadSaveIntoWorld(target);
  }, [existingSave, handleStartNewGame, handleLoadSaveIntoWorld]);

  const handleReturnTitle = useCallback(() => {
    const current = engineRef.current?.getSaveSnapshot() ?? save;
    persistProgress(current, true);
    setActiveTab(null);
    setScreenState('title');
    engineRef.current?.setGameState('title');
  }, [save, persistProgress]);

  const handleOpenModal = useCallback((tab: ActiveModalTab) => {
    if (screenStateRef.current === 'gameover' || screenStateRef.current === 'title') return;
    if (engineRef.current) {
      setSave(engineRef.current.getSaveSnapshot());
    }
    if (tab === null) {
      setActiveTab(null);
      setScreenState('playing');
      engineRef.current?.setGameState('playing');
    } else {
      setActiveTab(tab);
      setScreenState('paused');
      engineRef.current?.setGameState('paused');
    }
  }, []);

  const handleUpdateSave = useCallback(
    (next: GameSaveRecord, toastMsg?: string, syncCloud?: boolean) => {
      setSave(next);
      engineRef.current?.syncWorldFromSave(next);
      if (toastMsg) showToast(toastMsg);
      persistProgress(next, Boolean(syncCloud));
    },
    [persistProgress, showToast],
  );

  const handleManualSave = useCallback(async () => {
    const current = engineRef.current?.getSaveSnapshot() ?? save;
    setCloudSaving(true);
    try {
      const res = await saveCloudProgress(userRef.current, current);
      setExistingSave(current);
      if (res.savedToCloud) {
        showToast('Saved progress to Google Cloud.');
      } else {
        showToast('Saved locally. Sign in with Google for cross-device cloud sync.');
      }
    } catch {
      showToast('Saved locally (offline fallback).');
    } finally {
      setCloudSaving(false);
    }
  }, [save, showToast]);

  const handleQuickConsume = useCallback(
    (category: 'food' | 'water' | 'medicine') => {
      const current = engineRef.current?.getSaveSnapshot() ?? save;
      const candidate = current.payload.inventory.find(
        (item) => ITEMS_CATALOG[item.itemId]?.category === category,
      );
      if (!candidate) {
        const label =
          category === 'medicine' ? 'medical supplies' : category === 'food' ? 'food' : 'water';
        showToast(`No ${label} remaining in bag!`);
        return;
      }
      const res = consumeItem(current, candidate.itemId);
      handleUpdateSave(res.save, res.message, res.ok);
    },
    [save, handleUpdateSave, showToast],
  );

  const handleGoogleSignIn = useCallback(async () => {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      const signedIn = await signInWithGoogleAccount();
      showToast(`Welcome back, ${signedIn.displayName || 'Survivor'}!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in canceled or blocked.';
      setAuthMessage(msg);
    } finally {
      setAuthLoading(false);
    }
  }, [showToast]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOutAccount();
      showToast('Signed out of Google Cloud Save.');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }, [showToast]);

  // Global keyboard shortcuts for Title start, Modals (I/B/M/V/J/P/Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (showPortalRef.current) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowPortal(false);
        }
        return;
      }

      if (screenStateRef.current === 'title') {
        if ((e.code === 'Enter' || e.code === 'Space') && !showCharSelectRef.current) {
          e.preventDefault();
          handleStartNewGame();
        } else if (e.code === 'Escape' && showCharSelectRef.current) {
          setShowCharSelect(false);
        }
        return;
      }

      if (screenStateRef.current === 'gameover') return;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (activeTabRef.current) {
          handleOpenModal(null);
        } else {
          handleOpenModal('pause');
        }
      } else if (e.code === 'KeyI') {
        e.preventDefault();
        handleOpenModal(activeTabRef.current === 'inventory' ? null : 'inventory');
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        handleOpenModal(activeTabRef.current === 'crafting' ? null : 'crafting');
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handleOpenModal(activeTabRef.current === 'map' ? null : 'map');
      } else if (e.code === 'KeyV') {
        e.preventDefault();
        handleOpenModal(activeTabRef.current === 'base' ? null : 'base');
      } else if (e.code === 'KeyJ') {
        e.preventDefault();
        handleOpenModal(activeTabRef.current === 'codex' ? null : 'codex');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleStartNewGame, handleOpenModal]);

  const selectedCharacter: CharacterProfile = useMemo(
    () => getCharacterById(selectedCharId),
    [selectedCharId],
  );

  const activeCharacter: CharacterProfile = useMemo(
    () => getCharacterById(save.characterId),
    [save.characterId],
  );

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-[#0b0d10]">
      {/* Persistent Three.js Canvas Mount */}
      <div
        ref={canvasMountRef}
        data-testid="world-canvas"
        className="fixed inset-0 z-0 h-full w-full"
      />

      {/* Title Screen */}
      {screenState === 'title' && (
        <AuthTitleScreen
          user={user}
          authLoading={authLoading}
          authMessage={authMessage}
          selectedCharacter={selectedCharacter}
          existingSave={existingSave}
          mode={mode}
          difficulty={difficulty}
          onChangeMode={setMode}
          onChangeDifficulty={setDifficulty}
          onGoogleSignIn={handleGoogleSignIn}
          onSignOut={handleSignOut}
          onOpenCharacters={() => setShowCharSelect(true)}
          onOpenPortal={() => setShowPortal(true)}
          onStartNewGame={handleStartNewGame}
          onContinueGame={handleContinueGame}
        />
      )}

      {/* Character Roster Modal */}
      {showCharSelect && screenState === 'title' && (
        <CharacterSelectModal
          selectedId={selectedCharId}
          onSelect={(char) => setSelectedCharId(char.id)}
          onClose={() => setShowCharSelect(false)}
        />
      )}

      {/* Live Survival HUD */}
      {(screenState === 'playing' || screenState === 'paused') && (
        <SurvivalHUD
          hud={hud}
          characterName={activeCharacter.name}
          muted={muted}
          touchEnabled={touchEnabled}
          toast={toast}
          onToggleTouch={() => {
            manualTouchOverrideRef.current = true;
            setTouchEnabled((prev) => !prev);
          }}
          onToggleMute={() => {
            const next = !muted;
            soundEngine.setMuted(next);
            setMuted(next);
          }}
          onOpenModal={handleOpenModal}
          onQuickConsume={handleQuickConsume}
          onTouchMove={(x, z) => engineRef.current?.setMoveInput(x, z)}
          onTouchSprint={(active) => engineRef.current?.setTouchSprint(active)}
          onAttack={() => engineRef.current?.triggerAttack()}
          onInteract={() => engineRef.current?.triggerInteract()}
          onReload={() => engineRef.current?.triggerReload()}
          onCrouch={() => engineRef.current?.toggleCrouch()}
        />
      )}

      {/* Gameplay Modals & Game Over */}
      {(activeTab !== null || screenState === 'gameover') && (
        <GameModals
          activeTab={activeTab}
          gameOver={screenState === 'gameover'}
          save={save}
          cloudSaving={cloudSaving}
          onClose={() => handleOpenModal(null)}
          onSwitchTab={handleOpenModal}
          onUpdateSave={handleUpdateSave}
          onManualSave={handleManualSave}
          onOpenPortal={() => setShowPortal(true)}
          onRestartGame={handleStartNewGame}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {/* Account, Save Slots, Backup Recovery & Admin Portal */}
      {showPortal && (
        <AccountPortalModal
          user={user}
          authLoading={authLoading}
          currentSave={engineRef.current?.getSaveSnapshot() ?? save}
          onGoogleSignIn={handleGoogleSignIn}
          onSignOut={handleSignOut}
          onLoadSaveIntoWorld={handleLoadSaveIntoWorld}
          onNotify={showToast}
          onClose={() => setShowPortal(false)}
        />
      )}
    </main>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GameShell />
    </ErrorBoundary>
  );
}
