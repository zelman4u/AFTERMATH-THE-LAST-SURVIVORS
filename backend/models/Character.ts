import { PLAYABLE_CHARACTERS } from '../../src/game/data';
import type { CharacterProfile } from '../../src/game/types';

export type CharacterDocument = CharacterProfile;

export const CharacterCollectionSchema = {
  collection: 'characters',
  indexes: ['id', 'gender'],
  seedCount: PLAYABLE_CHARACTERS.length,
} as const;

export function getAllCharacterDocuments(): CharacterDocument[] {
  return PLAYABLE_CHARACTERS;
}
