# Firestore Security Specification — AFTERMATH: The Last Survivors

## 1. Data Invariants
1. **Strict Ownership & PII Isolation**: `/users/{userId}` contains player email/profile metadata and is strictly readable and writable only by `request.auth.uid == userId` (with `email_verified == true`). No blanket `isSignedIn()` read or list is permitted.
2. **Master Gate on Subcollections**: `/users/{userId}/saves/{saveId}` inherits ownership from the parent `/users/{userId}` document (`exists(...)` and `userId == request.auth.uid`) and validates `incoming().ownerId == request.auth.uid`.
3. **Immutable Identity & Creation Timestamps**: `uid`, `ownerId`, `saveId`, and `createdAt` cannot be modified after creation. All `createdAt` and `updatedAt` fields must equal `request.time`.
4. **Strict Key & Size Enforcement**: Every create enforces `hasAll` + `hasOnly` and every update enforces `affectedKeys().hasOnly(...)` alongside `isValidUserProfile` / `isValidGameSave`. All strings and arrays have bounded lengths to prevent resource poisoning.
5. **No Unprotected Collections**: Global catch-all denies all unmatched paths (`match /{document=**} { allow read, write: if false; }`).

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. Unauthenticated `get` on `/users/userA`.
2. Authenticated `userB` attempting `get` on `/users/userA` (PII leak attempt).
3. Authenticated `userA` attempting `list` on `/users` collection (scraping attempt).
4. Authenticated `userA` attempting `create` on `/users/userA` with unverified email (`email_verified: false`).
5. Authenticated `userA` attempting `create` on `/users/userA` with a shadow field `isAdmin: true`.
6. Authenticated `userA` attempting `create` on `/users/userA` with mismatched `uid: "userB"`.
7. Authenticated `userA` attempting `update` on `/users/userA` modifying immutable `createdAt`.
8. Authenticated `userA` attempting `create` on `/users/userA/saves/main` with `ownerId: "userB"`.
9. Authenticated `userA` attempting `create` on `/users/userA/saves/main` with oversized `characterId` (> 64 chars) or invalid `saveId` (`"bad/id$1"`).
10. Authenticated `userA` attempting `create` on `/users/userA/saves/main` with client-forged `updatedAt` != `request.time`.
11. Authenticated `userB` attempting `update` or `delete` on `/users/userA/saves/main`.
12. Authenticated `userA` attempting `update` on `/users/userA/saves/main` with invalid `mode: "godmode"` or shadow key `hackedCredits: 999999`.
