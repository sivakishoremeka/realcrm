# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RealCRM — real-estate operations app for Hyderabad. Matches buyer requirements (leads) to publishers (agents/owners), lets publishers post properties, and lets customers browse listings and send enquiries. Two independent npm projects in one repo:

- `backend/` — Node.js + Express + Mongoose (CommonJS), JWT auth with optional Google Sign-In; integrates AWS S3, OpenAI, and Meta Graph API
- `mobile/` — React Native 0.86 via Expo SDK 57 (Android-first), React 19, React Navigation 7, axios, react-native-maps, `@expo/vector-icons`

Early MVP stage, no CI. A fourth "Management Service" persona is planned but not implemented. README.md has the full API route table, env var reference, and Instagram/S3 setup steps.

## Commands

```bash
docker compose up -d                    # local MongoDB on 127.0.0.1:27017

cd backend && npm install
npm run dev                             # node --watch server.js, listens on 0.0.0.0:5000
npm test                                # node:test — runs *.test.js (currently services/facetSearch.test.js)
node --test services/facetSearch.test.js   # single test file

cd mobile && npm install
npx expo start --android                # emulator reaches host API at http://10.0.2.2:5000
npx expo start --tunnel                 # if a physical device can't reach the dev server over Wi-Fi
```

No linter or build step. Backend tests cover pure services only; verify route changes by running the API and the smoke-test flow in README.md.

Backend requires `backend/.env` (copy `.env.example`): server exits on startup if `MONGO_URI` is missing or `JWT_SECRET` < 16 chars. Hyderabad zones are seeded on every startup (`seed/zones.js`).

## Architecture

### Roles
`User.role` is `admin | publisher | customer`. Legacy `agent`, `owner`, and `sales` values are still in the enum and are migrated to `publisher` on save/login. `middleware/roles.js` handles the aliasing both ways: `normalizeRole()` maps legacy values to `publisher`, and `requireRole('agent'|'owner'|'publisher')` all accept any publisher. So existing routes written as `requireRole('owner')` or `requireRole('agent')` effectively mean "any publisher". Always go through `normalizeRole` / `requireRole` / `isPublisher`, never compare `user.role` directly.

- **admin** ("Business Owner" in the UI) — not chosen at registration; any account whose email equals `ADMIN_EMAIL` is promoted on register/login (`routes/auth.js`).
- **publisher** — one login that can post **as Agent** (inventory) or **as Owner** (listing with T&Cs); also creates/serves leads. Goes through onboarding (`AgentProfile`) first.
- **customer** — browses Available listings and sends enquiries.

Route protection: `auth` middleware (Bearer JWT → `req.user`, password excluded) then `requireRole(...)`. Finer-grained access (e.g. a requirement is visible only to admin, its `createdBy` lead generator, or its `assignedAgent`) lives in helpers inside the route file (`canAccessRequirement` / `canEditRequirement` in `routes/requirements.js`).

### One `Property` model, two posting modes
`models/Property.js` holds both modes: posted as agent sets `agent`, posted as owner sets `owner` (`routes/properties.js` derives `postAs` from which field matches the user). Type-specific optional fields: `residenceStyle`, `carpetArea`, `facing`, `villaType`, `plotSize`. Status: `Draft | Available | Hold | Deal | Blocked | Sold`.
- `/api/properties` — agent-mode inventory, `GET /mine` (both modes, faceted), reel video upload (local disk `backend/uploads/videos`, served at `/uploads`), LLM captions, Instagram publish
- `/api/listings` — owner-mode listings; `Draft` until publish, which requires ≥1 image, non-empty terms, and `accepted: true`. T&C template in `constants/ownerTermsTemplate.js`. `listedViaAgent` / `viaAgentNote` are informational only.
- `/api/marketplace` — customer-facing: browse Available listings, create/list enquiries (`models/Enquiry.js`, status `Open | Contacted | Closed`); publishers/admin see and update enquiries on their properties.

### S3 images: store canonical, return signed
`services/s3.js` uploads under `listings/…`, `inventory/…`, and `avatars/…`. The DB stores the **canonical (unsigned) URL**; every response that includes images or `profilePic` must pass through `withSignedImages` / `withSignedImagesMany` / `signStoredImageUrl` to return presigned GET URLs (TTL `S3_SIGNED_URL_TTL`, default 6h). The bucket can stay private. When comparing or deleting images sent back by the client, normalize with `canonicalImageUrl` / `imageUrlsEqual` since the client holds signed URLs.

### Faceted list search
`services/facetSearch.js` (`createFacetSearch`, `searchPosts`, `searchLeads`) filters a user's records **in memory** and returns `{ items, facets, total }`, where each facet's counts ignore its own selection. Used by `GET /api/properties/mine` and `GET /api/requirements/search`; query params are `q` plus comma-separated facet values. On mobile, `src/hooks/useFacetSearch.js` + `components/FacetFilters.js` consume this shape. Lead "stage" (New/Matched/Assigned/Closed/Sent) and read/unread (`Requirement.readBy`, `select: false`) are computed per user in `leadStage`.

### Lead → match → assign
`Requirement` (buyer lead, linked to a `Customer` CRM record — distinct from `customer`-role users) is created by admin or publisher; the creator is the lead generator. `services/matchEngine.js` scores onboarded publishers (`AgentProfile.onboardingComplete`): +40 zone, +30 matching Available inventory (type + listingType + preferred zone), +20 BHK, +10 budget, +0–15 from `ratingAvg`, capped at 100. Assigning sets `assignedAgent`; commission split is `commissionPercent` × `leadGenSharePercent` (remainder to serving agent). `Interaction` records buyer-care follow-ups.

### Ratings
`AgentReview` has `source: admin | customer | leadgen` and is unique per `(author, agent, contextKey)`, where `contextKey` is `admin`, `req:<requirementId>`, or `enq:<enquiryId>`. `routes/reviews.js` recomputes `AgentProfile.ratingAvg/ratingCount`, which feed matching and the color-coded star ring on avatars (`components/RatedAvatar.js`, `constants/rating.js`).

### Zones
`ServiceZone` holds named Hyderabad localities with lat/lng. Defaults are seeded at startup; custom zones via `POST /api/zones`. `AgentProfile.zones`, `Property.zone`, and `Requirement.preferredZones` reference these IDs.

### Secrets per publisher
OpenAI key and Meta page token are stored on `AgentProfile` (`openaiApiKeyEnc`, `metaAccessTokenEnc`), encrypted AES-256-GCM via `services/tokenCrypto.js` (`TOKEN_ENC_KEY`, falls back to `JWT_SECRET`). Caption generation uses the publisher's own key. Instagram publish needs a public HTTPS `PUBLIC_API_URL` (ngrok in dev) so Meta can fetch the video.

### Mobile
- `src/api/client.js` — single axios instance; base URL is user-configurable on Login ("Server settings") and persisted in AsyncStorage; token attached from AsyncStorage; 401 triggers the handler registered by `AuthContext` (logout).
- `src/navigation/AppNavigator.js` — picks a tree by normalized role: Auth stack → Onboarding (publisher without completed profile) → Publisher / Admin / Customer tab+stack navigators.
- UI is built from shared components in `src/components/` (`ScreenHeader`, `Card`, `Button`, `Field`, `PriceField`, `ChipRow`, `EmptyState`, `Fab`, `SwipeableStatusRow`, …) and tokens in `src/constants/theme.js` (navy `colors.primary`, `spacing`, `radius`). Use these instead of ad-hoc styles.
- Shared enums (statuses, property/listing types, interaction types, status colors) are in `src/constants/config.js` and must stay in sync with backend Mongoose enums.
- `src/utils/whatsappShare.js` builds prefilled WhatsApp messages for property shares and lead requests.

## Conventions
- Backend error responses are `{ message }` JSON; global handler in `server.js` maps Multer/upload-filter errors to 400.
- In-app tone is "community service / keep the buyer happy", not hard-sell CRM jargon (e.g. "buyer care", "lead generator").
