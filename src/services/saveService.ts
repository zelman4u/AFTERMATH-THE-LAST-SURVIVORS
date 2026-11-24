import {
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import type { GameSaveRecord } from '../game/types';
import {
  getPersistentGuestId,
  putSaveSlot,
  queueOfflineSave,
  syncAuthSession,
  type SaveSlotId,
} from './api';

const LOCAL_SAVE_PREFIX = 'aftermath_save_v1_';

export async function signInWithGoogleAccount(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  await ensureUserProfile(user);
  syncAuthSession().catch(() => {});
  return user;
}

export async function signOutAccount(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const safeDisplayName = (user.displayName || 'Survivor').slice(0, 120);
  const safeEmail = (user.email || '').slice(0, 254);
  const safePhotoUrl = (user.photoURL || '').slice(0, 512);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName: safeDisplayName,
        email: safeEmail,
        photoURL: safePhotoUrl,
        lastCharacterId: 'ethan_walker',
        highestDay: 1,
        totalKills: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName: safeDisplayName,
        email: safeEmail,
        photoURL: safePhotoUrl,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function saveLocalBackup(save: GameSaveRecord, slotId: SaveSlotId = 'active'): void {
  try {
    const owner = save.ownerId || getPersistentGuestId();
    const key = `${LOCAL_SAVE_PREFIX}${owner}_${slotId}`;
    localStorage.setItem(key, JSON.stringify({ ...save, saveId: slotId }));
    // Keep legacy active key readable as well
    if (slotId === 'active') {
      localStorage.setItem(`${LOCAL_SAVE_PREFIX}${owner}`, JSON.stringify(save));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function loadLocalBackup(ownerId: string, slotId: SaveSlotId = 'active'): GameSaveRecord | null {
  try {
    const raw =
      localStorage.getItem(`${LOCAL_SAVE_PREFIX}${ownerId}_${slotId}`) ||
      (slotId === 'active' ? localStorage.getItem(`${LOCAL_SAVE_PREFIX}${ownerId}`) : null);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameSaveRecord;
    if (!parsed || !parsed.characterId || !parsed.payload) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCloudProgress(
  user: User | null,
  save: GameSaveRecord,
  slotId: SaveSlotId = (save.saveId as SaveSlotId) || 'active',
  reason: 'auto' | 'manual' | 'sync' = 'manual',
): Promise<{ savedToCloud: boolean; savedToServer: boolean; error?: string }> {
  const safeSlot: SaveSlotId =
    slotId === 'slot_1' || slotId === 'slot_2' || slotId === 'slot_3' ? slotId : 'active';

  const updatedSave: GameSaveRecord = {
    ...save,
    saveId: safeSlot,
    ownerId: user?.uid || save.ownerId || getPersistentGuestId(),
    version: save.version + 1,
    updatedAtIso: new Date().toISOString(),
  };

  saveLocalBackup(updatedSave, safeSlot);

  // Sync to Express + MongoDB-schema backend (creates rotating 10-snapshot backup history)
  let savedToServer = false;
  try {
    await putSaveSlot(safeSlot, updatedSave, reason);
    savedToServer = true;
  } catch {
    queueOfflineSave(safeSlot, updatedSave);
  }

  if (!user || !user.emailVerified) {
    return { savedToCloud: false, savedToServer };
  }

  const savePath = `users/${user.uid}/saves/${safeSlot}`;
  const saveRef = doc(db, 'users', user.uid, 'saves', safeSlot);
  const userRef = doc(db, 'users', user.uid);

  try {
    await ensureUserProfile(user);
    const existingSnap = await getDoc(saveRef);
    const baseData = {
      saveId: safeSlot,
      ownerId: user.uid,
      version: updatedSave.version,
      characterId: updatedSave.characterId,
      mode: updatedSave.mode,
      difficulty: updatedSave.difficulty,
      day: Math.max(1, Math.round(updatedSave.day)),
      timeOfDay: Math.max(0, Math.min(24, Number(updatedSave.timeOfDay.toFixed(2)))),
      weather: updatedSave.weather,
      payload: updatedSave.payload,
      updatedAt: serverTimestamp(),
    };

    if (!existingSnap.exists()) {
      await setDoc(saveRef, {
        ...baseData,
        createdAt: serverTimestamp(),
      });
    } else {
      const serverVersion = Number(existingSnap.data()?.version ?? 0);
      await updateDoc(saveRef, {
        ...baseData,
        version: Math.max(updatedSave.version, serverVersion + 1),
      });
    }

    await updateDoc(userRef, {
      lastCharacterId: updatedSave.characterId,
      highestDay: Math.max(1, Math.round(updatedSave.day)),
      totalKills: updatedSave.payload.zombieKills,
      updatedAt: serverTimestamp(),
    });

    return { savedToCloud: true, savedToServer };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, savePath);
  }
}

export async function loadCloudProgress(
  user: User,
  slotId: SaveSlotId = 'active',
): Promise<GameSaveRecord | null> {
  const savePath = `users/${user.uid}/saves/${slotId}`;
  const saveRef = doc(db, 'users', user.uid, 'saves', slotId);
  try {
    const snap = await getDoc(saveRef);
    if (!snap.exists()) {
      return loadLocalBackup(user.uid, slotId);
    }
    const data = snap.data();
    const loaded: GameSaveRecord = {
      saveId: String(data.saveId || slotId),
      ownerId: String(data.ownerId || user.uid),
      version: Number(data.version || 1),
      characterId: String(data.characterId || 'ethan_walker'),
      mode: data.mode === 'endless' ? 'endless' : 'story',
      difficulty:
        data.difficulty === 'hard' || data.difficulty === 'nightmare'
          ? data.difficulty
          : 'normal',
      day: Number(data.day || 1),
      timeOfDay: Number(data.timeOfDay || 8),
      weather: data.weather || 'clear',
      payload: data.payload,
      updatedAtIso: new Date().toISOString(),
    };
    saveLocalBackup(loaded, slotId);
    return loaded;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, savePath);
  }
}
