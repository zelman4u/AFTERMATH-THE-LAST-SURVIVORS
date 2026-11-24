# AFTERMATH — 14-Collection Database Structure

All collections are persisted via `backend/config/database.ts` (`backend/database/store.json`) and mirror Mongoose/MongoDB schemas (`backend/models/*.ts`) alongside Google Cloud Firestore (`users/{uid}/saves/{slotId}`).

| # | Collection | Purpose |
|---|---|---|
| 1 | `users` | Verified Google Auth UIDs, display names, email, `isAdmin` role flags |
| 2 | `players` | Aggregate progression (`highestDay`, `totalZombieKills`, `totalScore`, achievements) |
| 3 | `characters` | 12 playable survivor base attributes & specialties |
| 4 | `inventories` | Server-validated item stacks, upgrade levels, and backpack weight checks |
| 5 | `weapons` | Firearms and melee combat definitions |
| 6 | `armor` | Protective vests, helmets, and hazard gear |
| 7 | `craftingrecipes` | Workbench tier 1–3 item recipes |
| 8 | `bases` | Player-constructed 3D base structures & coordinates |
| 9 | `worlds` | Day/night clock, weather, discovered zones, defeated bosses, NPCs |
| 10 | `quests` | 7-chapter story campaign definitions and completion tracking |
| 11 | `zombies` | 8 standard & special infected archetypes |
| 12 | `bosses` | 4 high-level boss archetypes |
| 13 | `gamesaves` | Multi-slot save snapshots (`active`, `slot_1`, `slot_2`, `slot_3`) + SHA-256 checksums |
| 14 | `achievements` | Survival milestone definitions |
| + | `savebackups` | Rotating 10-snapshot rollback history per player/slot |
