export interface UserDocument {
  _id: string;
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'player' | 'admin';
  provider: 'google' | 'guest';
  createdAtIso: string;
  lastLoginIso: string;
}

export const UserCollectionSchema = {
  collection: 'users',
  indexes: ['uid', 'email'],
  requiredFields: ['uid', 'email', 'role'],
} as const;
