# AFTERMATH: The Last Survivors

Cross-platform 3D open-world zombie survival game featuring:
- **Playable 3D Web Client (`src/`)**: Full-viewport Three.js survival world with responsive desktop keyboard/mouse and mobile/tablet dual-touch controls.
- **Node.js + Express Backend (`server.ts` & `backend/`)**: Multi-slot saves (`active`, `slot_1`–`slot_3`), 10-snapshot backup recovery, anti-duplication inventory validation, cryptographic Firebase ID token verification, and 14-collection document storage.
- **Account Portal, Save Slots & Admin Console (`src/pages/`)**: Manage save slots, roll back save snapshots, inspect lifetime survival stats, and view admin database telemetry.
- **Unity 6 C# Scripts (`game-client/`)**: Ready-to-import Unity C# gameplay and REST API sync scripts.
- **Documentation (`documentation/`)**: Game Design Document, Database Structure, and API Reference.

## Quick Start
```bash
npm install
npm run dev
```
Open `http://localhost:3000` on desktop, laptop, tablet, or phone.
