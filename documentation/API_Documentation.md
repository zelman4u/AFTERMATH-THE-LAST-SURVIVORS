# AFTERMATH — Backend REST API Documentation

Base URL: `http://localhost:3000/api`

All authenticated requests pass `Authorization: Bearer <Firebase_ID_Token>`. Guest / offline-first slots send `x-guest-id: guest_<id>`. All JSON bodies and query strings are scanned for MongoDB `$` / `.` injection keys.

## Endpoints

- `GET /api/health` — Returns service health, database mode (`json-document-store` or `mongodb`), collection count, and active save count.
- `GET /api/auth/status` — Checks whether a valid Firebase Bearer token was supplied and whether `isAdmin` is true.
- `POST /api/auth/session` *(Auth Required)* — Upserts verified Google user in the `users` collection.
- `GET /api/players/profile` — Returns player lifetime records (`highestDay`, `totalZombieKills`, `totalScore`, achievements).
- `GET /api/characters` — Lists all 12 playable survivors.
- `GET /api/world/config` — Returns zones, zombies, items, recipes, structures, NPCs, quests, and achievements.
- `POST /api/inventory/validate` — Validates item IDs, quantities (max 999), and backpack weight capacity.
- `GET /api/saves` — Lists all save slots (`active`, `slot_1..slot_3`) and backup counts for the caller.
- `PUT /api/saves/:slotId` — Validates inventory and saves progress, automatically rotating up to 10 previous backup snapshots.
- `GET /api/saves/:slotId/backups` — Lists backup snapshots for rollback recovery.
- `POST /api/saves/:slotId/restore/:backupId` — Restores a selected backup snapshot into `:slotId`.
- `DELETE /api/saves/:slotId` — Deletes a save slot and its backup history.
- `GET /api/admin/overview` *(Admin Token Required)* — Returns user counts, player records, save metrics, and anti-cheat audit logs.
