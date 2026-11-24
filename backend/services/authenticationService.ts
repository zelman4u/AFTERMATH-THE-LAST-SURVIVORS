import { database } from '../config/database';
import type { VerifiedAuthUser } from '../middlewares/authMiddleware';
import type { UserDocument } from '../models/User';

export function syncAuthenticatedUser(authUser: VerifiedAuthUser): UserDocument {
  const store = database.getStore();
  const existing = store.users[authUser.uid] as unknown as UserDocument | undefined;
  const nowIso = new Date().toISOString();

  const userDoc: UserDocument = {
    _id: authUser.uid,
    uid: authUser.uid,
    email: authUser.email,
    displayName: authUser.name,
    photoURL: authUser.picture,
    role: authUser.isAdmin ? 'admin' : 'player',
    provider: 'google',
    createdAtIso: existing?.createdAtIso || nowIso,
    lastLoginIso: nowIso,
  };

  store.users[authUser.uid] = userDoc as unknown as Record<string, unknown>;
  database.persist();
  return userDoc;
}
