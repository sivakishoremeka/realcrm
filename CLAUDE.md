# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RealCRM — real-estate CRM for Hyderabad. Matches buyer requirements (leads) to agents, and lets property owners publish listings. Two independent npm projects in one repo:

- `backend/` — Node.js + Express + Mongoose (CommonJS), JWT auth with optional Google Sign-In; integrates AWS S3, OpenAI, and Meta Graph API
- `mobile/` — React Native 0.74 via Expo SDK 51 (Android-first), React Navigation 6, axios, react-native-maps

Early MVP stage: single initial commit, no CI.

README.md has the full API route table, env var reference, and Instagram/S3 setup steps.

## Commands

```bash
docker compose up -d                    # local MongoDB on 127.0.0.1:27017

cd backend && npm install
npm run dev                             # node --watch server.js, listens on 0.0.0.0:5000
npm start

cd mobile && npm install
npx expo start --android                # emulator reaches host API at http://10.0.2.2:5000
```

There is no test suite, linter, or build step in either project. Verify changes by running the API and exercising the smoke-test flow in README.md.

Backend requires `backend/.env` (copy `.env.example`): server exits on startup if `MONGO_URI` is missing or `JWT_SECRET` < 16 chars. Hyderabad zones are seeded on every startup (`seed/zones.js`).

## Architecture

### Roles
`User.role` is `admin | agent | owner` (plus legacy `sales`, always treated as `agent` — see `User.normalizedRole()` and `middleware/roles.js`). Always compare roles through `normalizeRole` / `requireRole`, never `user.role` directly. Admin is not chosen at registration: any account whose email equals `ADMIN_EMAIL` is promoted to admin on register/login (`routes/auth.js`).

Route protection pattern: `auth` middleware (Bearer JWT → `req.user`, password excluded) then `requireRole(...)` per route. Finer-grained access (e.g. requirement visible only to admin, its `createdBy` lead generator, or its `assignedAgent`) lives in helpers inside the route file (`canAccessRequirement` / `canEditRequirement` in `routes/requirements.js`).

### One `Property` model, two personas
`models/Property.js` holds both agent inventory (`agent` set) and owner listings (`owner` set). They are served by different routers:
- `/api/properties` — agent inventory, reel video upload (local disk `backend/uploads/videos`, served statically at `/uploads`), LLM captions, Instagram publish
- `/api/listings` — owner listings; photos go to S3 (`services/s3.js`, keys `listings/{ownerId}/{listingId}/…`); status `Draft` until publish, which requires ≥1 image, non-empty terms, and `accepted: true`. T&C template in `constants/ownerTermsTemplate.js`. `listedViaAgent` / `viaAgentNote` are informational only — there is no agent-claim workflow behind them yet.

### Zones
`ServiceZone` holds named Hyderabad localities with lat/lng (shown on maps in agent onboarding/profile). Defaults are seeded at startup; custom zones are added via `POST /api/zones`. Agents' `AgentProfile.zones` and requirements' `preferredZones` reference these IDs.

### Lead → match → assign
`Requirement` (buyer lead, linked to a `Customer`) is created by admin or agent; the creator is the lead generator. `services/matchEngine.js` scores onboarded agents (`AgentProfile.onboardingComplete`): +40 zone, +30 matching Available inventory (type + listingType + preferred zone), +20 BHK, +10 budget, +0–15 from `ratingAvg`, capped at 100. Assigning sets `assignedAgent`; commission split is `commissionPercent` × `leadGenSharePercent` (remainder to serving agent). `AgentReview` ratings update `AgentProfile.ratingAvg/ratingCount`, which feed back into matching. `Interaction` records buyer-care follow-ups.

### Secrets per agent
Agents store their own OpenAI key and Meta page tokens on their profile, encrypted with AES-256-GCM via `services/tokenCrypto.js` (`TOKEN_ENC_KEY`, falls back to `JWT_SECRET`). Caption generation (`services/captionLlm.js`) uses the agent's own key. Instagram publish needs a public HTTPS `PUBLIC_API_URL` (ngrok in dev) so Meta can fetch the video.

### Mobile
- `src/api/client.js` — single axios instance; base URL is user-configurable on Login ("Server settings") and persisted in AsyncStorage; token attached from AsyncStorage; 401 triggers the handler registered by `AuthContext` (logout).
- `src/context/AuthContext.js` — auth state, role, `needsOnboarding`.
- `src/navigation/AppNavigator.js` — picks a stack by role: Auth stack → Onboarding (agents without completed profile) → Agent / Admin / Owner tab navigators.
- `src/utils/whatsappShare.js` — builds prefilled WhatsApp messages for property shares and lead (buyer-care) requests.
- Shared enums (statuses, property/listing types, interaction types, status colors) are in `src/constants/config.js` and must stay in sync with backend Mongoose enums.

## Conventions
- Backend error responses are `{ message }` JSON; global handler in `server.js` maps Multer/upload-filter errors to 400.
- In-app tone is "community service / keep the buyer happy", not hard-sell CRM jargon (e.g. "buyer care", "lead generator").
