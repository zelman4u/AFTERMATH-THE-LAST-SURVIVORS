import { ACHIEVEMENTS_LIST, STORY_CHAPTERS } from '../../src/game/data';

export const QuestCollectionSchema = {
  collection: 'quests',
  source: STORY_CHAPTERS,
};

export const AchievementCollectionSchema = {
  collection: 'achievements',
  source: ACHIEVEMENTS_LIST,
};
