# RealCRM — Real Estate Matching

Four-persona real-estate operations app (Management Service persona planned next).

- **Publisher** (Owner / Agent) — one login; post **as Agent** (inventory) or **as Owner** (T&Cs + publish); leads, match, WhatsApp, Instagram
- **Customer** — browse available listings, send enquiries
- **Business Owner** (`admin`) — run matching, publishers directory, buyer CRM
- **Management Service** — *deferred* (property supervisor / services)
- **Backend:** Node.js + Express + MongoDB + JWT (+ optional Google Sign-In, OpenAI, Meta Graph, S3)
- **Frontend:** React Native (Expo) for Android

```
realcrm/
├── backend/          # Express API
├── mobile/           # Expo app
└── docker-compose.yml
```

## Personas / roles

| Persona | Role key | How to get it | App home |
|---------|----------|---------------|----------|
| **Business Owner** | `admin` | Register/login with `ADMIN_EMAIL` (default `admin@realcrm.app`) | Match → Publishers → Buyers |
| **Publisher** | `publisher` | Register as **Publisher** (default) | Onboarding → My Posts (Agent or Owner) + Leads + Profile |
| **Customer** | `customer` | Register as **Customer** | Browse → Enquiries → Profile |
| **Management Service** | — | Not in this release | — |

Legacy `agent` / `owner` accounts migrate to `publisher` on login.

### Customer marketplace

1. Register as **Customer**  
2. **Browse** Available listings (filters: listing type, property type, area)  
3. Open a listing → **Send enquiry**  
4. Track status under **My enquiries**  

APIs: `GET /api/marketplace/listings`, `POST /api/marketplace/enquiries`, `GET /api/marketplace/enquiries/mine`.

### Profile photos & agent ratings

- Every user can upload a **profile picture** (`POST /api/auth/avatar`, S3 prefix `avatars/…`). Login/`/api/auth/me` return a **presigned** `profilePic`.
- Publisher avatars show a **color-coded 5-star ring**: 1★ red → 2★ orange → 3★ amber → 4★ green → 5★ teal (gray when unrated).
- Who can rate publishers:
  - **Customer** — after an enquiry, from **My enquiries** (`enquiry` on `POST /api/agents/:id/reviews`)
  - **Business Owner (admin)** — from agent detail (general rating) or on an assigned lead
  - **Lead generator (publisher)** — rate the serving agent on a requirement (existing flow)
- Aggregates live on `AgentProfile.ratingAvg` / `ratingCount` and boost match scores.

### Lead capture, match + share, split commission

Both **Admin** and **Agent** can:

1. Log a **Lead** with specs (Sale/Rent/Lease, type, BHK, budget) and preferred zones  
2. **Match** to agents ranked by zone/inventory fit **plus community ratings/reviews**  
3. **Assign** a serving agent or **WhatsApp-share** the buyer-care request  
4. As **lead generator**, log follow-ups (Call / FollowUp / SiteVisit / …) and set **commission split**: `commissionPercent` (total brokerage) and `leadGenSharePercent` (share to lead gen; serving agent gets the remainder)  
5. Rate the serving agent after work — ratings boost future match scores (up to +15)

Tone in the app: community service / keep the buyer happy — not hard-close CRM jargon.

### Property Owner persona

Owners create **their own** listings (not agent inventory). Flow:

1. Register → choose **Property Owner**
2. **My Listings** → add listing (Sale / Rent / Lease)
3. Upload **one or more photos**, edit the standard Hyderabad T&Cs template
4. Optionally toggle **Listed via agent** + free-text note (informational only — no agent claim workflow yet)
5. Check **I accept** → **Publish** → status becomes `Available` (drafts stay `Draft`)

Publish rules: ≥1 image, non-empty terms text, and `accepted: true`. Owner APIs are under `/api/listings` (agent Instagram/video paths stay on `/api/properties`). **Photos upload to AWS S3** (`listings/…` and `inventory/…`). The API returns **presigned GET URLs** so private buckets (Block Public Access) still render in the app — no public bucket policy required. Set `S3_BUCKET_NAME`, `AWS_REGION`, `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY` (IAM needs `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`).

## Matching score (MVP)

| Points | Rule |
|--------|------|
| +40 | Agent serves a preferred zone |
| +30 | Available inventory matches type + listing in preferred zones |
| +20 | BHK fits |
| +10 | Price within budget |
| +0–15 | Community rating (`ratingAvg` / 5 × 15 when reviews exist) |
| Cap | 100 |

Sort: score → rating → matching inventory count.

## Quick start

### 1. MongoDB

```bash
docker compose up -d
# or use Atlas URI in backend/.env
```

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

API: `http://0.0.0.0:5000`  
Hyderabad service zones seed on startup.

### 3. Mobile

```bash
cd mobile
npm install
npx expo start --android
```

The mobile app uses Expo SDK 57. Use an Expo Go version compatible with SDK 57; if your phone cannot connect to the development server over local Wi-Fi, start it with `npx expo start --tunnel`.

Emulator API URL: `http://10.0.2.2:5000` (Server settings on Login).

## Smoke test (happy path)

1. **Admin:** register `admin@realcrm.app` / password  
2. **Agent:** register another email as Agent → complete onboarding (phone + zones) → add a property in e.g. Gachibowli  
3. **Admin or Agent:** Leads/Match → New lead (same zone / type / budget) → ranked agents with ratings → Assign or WhatsApp share → set commission split → log a buyer-care follow-up  
4. **Owner:** register another email as Property Owner → create listing → add photos → accept T&Cs → Publish  

## Key API routes

| Method | Path | Role |
|--------|------|------|
| POST | `/api/auth/register` `/login` `/google` | Public (`role`: `publisher` \| `customer`) |
| GET | `/api/marketplace/listings` | Customer / Publisher / Admin |
| POST | `/api/marketplace/enquiries` | Customer |
| GET | `/api/marketplace/enquiries/mine` | Customer |
| GET/PUT | `/api/agents/me` | Agent |
| GET | `/api/agents` | Admin |
| GET | `/api/zones` | Auth |
| CRUD | `/api/properties` | Agent (own) / Admin |
| GET | `/api/properties/mine` | Publisher — own agent + owner posts as `{ items, facets, total }`. Query: `q`, `minPrice`, `maxPrice`, and comma-separated `postAs`, `status`, `type`, `listingType`, `bhk`, `zone` |
| GET | `/api/listings/terms-template` | Owner |
| GET | `/api/listings/mine` | Owner |
| POST/PUT/DELETE | `/api/listings` `/api/listings/:id` | Owner |
| POST | `/api/listings/:id/images` | Owner (multipart) |
| DELETE | `/api/listings/:id/images` | Owner |
| POST | `/api/listings/:id/publish` | Owner (`accepted: true`) |
| CRUD | `/api/requirements` | Admin + Agent create; Agent lists created/assigned |
| GET | `/api/requirements/search` | Admin + Agent — leads as `{ items, facets, total }`. Query: `q` and comma-separated `stage` (New, Matched, Assigned, Closed, Sent), `read` (Read, Unread), `listingType`, `propertyType`, `zone` |
| POST | `/api/requirements/:id/read` | Admin + Agent (with access) — mark lead as read |
| GET | `/api/requirements/:id/matches` | Admin + Agent (with access) |
| POST | `/api/requirements/:id/assign` | Admin + Agent (with access) |
| GET/POST | `/api/agents/:id/reviews` | Admin + Agent (lead gen rates serving agent) |
| GET/POST | `/api/interactions` | Admin, lead gen, assigned agent, customer owner |
| GET | `/api/instagram/oauth-url` `/status` | Agent |
| GET | `/api/instagram/callback` | Meta OAuth redirect |
| POST | `/api/properties/:id/video` | Agent (multipart) |
| POST | `/api/properties/:id/generate-caption` | Agent (LLM) |
| POST | `/api/properties/:id/publish-reel` | Agent → Instagram |

## Environment (`backend/.env`)

| Variable | Notes |
|----------|-------|
| `MONGO_URI` | Local or Atlas (prefer direct host list on Windows if SRV fails) |
| `JWT_SECRET` | ≥ 16 chars |
| `ADMIN_EMAIL` | Bootstrap admin account email |
| `GOOGLE_CLIENT_ID` | Optional Google Sign-In |
| `PUBLIC_API_URL` | Public **HTTPS** base (ngrok) so Meta can fetch reel videos |
| `META_APP_ID` / `META_APP_SECRET` | Instagram Graph OAuth + publish |
| `TOKEN_ENC_KEY` | Encrypts stored Meta page tokens + agent OpenAI keys |
| `S3_BUCKET_NAME` | Bucket for owner listing photos |
| `AWS_REGION` | e.g. `ap-south-1` |
| `AWS_S3_ACCESS_KEY_ID` / `AWS_S3_SECRET_ACCESS_KEY` | IAM user with `s3:PutObject` + `s3:DeleteObject` on the bucket |
| `S3_PUBLIC_BASE_URL` | Optional public/CDN base for image URLs |

Each **agent stores their own OpenAI API key** in Profile (`PUT /api/agents/me/openai-key`). Caption generation bills that agent’s OpenAI credits.

## Geography

Named Hyderabad zones with **lat/lng map pins**. Agent onboarding/profile shows a map preview of selected localities. Custom zones via `POST /api/zones`.

## Agent: WhatsApp + Instagram Reels

### WhatsApp

1. Open **Inventory** → tap a listing (or WhatsApp button on the card).  
2. Opens WhatsApp with a prefilled property message (Android).

### Instagram Reel auto-publish

1. Create a Meta Developer app with Instagram Graph API.  
2. Instagram **Business/Creator** account linked to a Facebook Page.  
3. Set Valid OAuth Redirect URI to:  
   `{PUBLIC_API_URL}/api/instagram/callback`  
4. Put `META_APP_ID`, `META_APP_SECRET`, `PUBLIC_API_URL` (HTTPS), optional `OPENAI_API_KEY` in `backend/.env`.  
5. In the app: **Profile → Save OpenAI key** (your `sk-...` from platform.openai.com — uses your credits).  
6. **Profile → Connect Instagram**.  
7. Open a property → **Upload reel video clip** → **Generate caption (LLM)** → edit → **Publish Reel to Instagram**.  

**Note:** Instagram requires a publicly reachable **HTTPS** `video_url`. For local dev, run an HTTPS tunnel (ngrok) and set `PUBLIC_API_URL`, then re-upload the video so `videoUrl` uses that host.
