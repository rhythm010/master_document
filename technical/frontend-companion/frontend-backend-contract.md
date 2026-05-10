# Frontend ↔ Backend Contract (Mobile Companion V1)

> **Living contract document** for how the mobile frontend (`technical/frontend-companion/companion-app/`) and backend (`technical/backend-companion/`) currently connect.
>
> **Rules of this doc:**
> - We only mark something **Implemented** when we can point to real code (routes/controllers/schemas) and/or tests.
> - If something is not proven by code, we label it **Planned** (milestone docs) or **Unknown / Needs confirmation**.
> - If the frontend needs something the backend does not support, we reference the **Backend Gap Register** IDs (e.g. `FE-BE-GAP-006`).
>
---

## 1. Executive Summary

This document is a **single place to understand and verify** the frontend↔backend contract for the Companion mobile app.

### What’s currently known (proven by code)

- **Backend routes are root-mounted** (no `/api/v1`): `/health`, `/auth/login`, `/venues`, `/bookings`, etc. (see `technical/backend-companion/src/app.ts`).
- **Backend error envelope is stable**: JSON `{ code, message }` for known errors; validation failures are normalized to `VALIDATION_ERROR`. (see `technical/backend-companion/src/shared/middleware/errorHandler.ts`).
- **Frontend has a real API client + token persistence**, and it uses `Authorization: Bearer <token>` on requests once a session is restored. (see `technical/frontend-companion/companion-app/lib/api-client.ts`, `store/session.ts`, `app/index.tsx`).
- **Identity endpoints exist in backend** (`/auth/signup`, `/auth/login`, `/users/me`, etc.), but the **frontend login/signup screens are still stubs** as of this workspace. (see `technical/frontend-companion/companion-app/app/(auth)/login.tsx`).

### Most important areas right now

1. **Auth / session behavior** (token storage, 401 handling, email verification flow)
2. **“Current state / next action”** for routing users after login (currently missing; blocks Milestone 3)
3. **Booking details contract** (companion reveal + terminal-state data needed for feedback)
4. **Deep link verification** (backend generates environment-specific schemes; frontend currently only declares `companion://`)
5. **Notifications / push** (backend placeholders; no push token registration contract)

### Major current gaps / unknowns (from gap register + code)

**Blockers:**
- `FE-BE-GAP-006` — Missing “current user booking / next action” endpoint
- `FE-BE-GAP-007` — Missing “assigned companion current booking lookup”
- `FE-BE-GAP-009` — Booking details companion reveal mismatch vs SDS
- `FE-BE-GAP-022` — Terminal booking details returns `companions: null`, blocking feedback screen data
- `FE-BE-GAP-015` — No push token registration + no real notification delivery service
- `FE-BE-GAP-025` — Staging/prod deployment URL + environment contract not finalized

**High-impact unknowns:**
- Deep link routing in the frontend for `auth/verify-email` is not implemented yet (backend generates links like `companion-dev://auth/verify-email?token=...`).
- Frontend behavior for invalid/expired tokens is “log out and go to login” even on network errors (may be too aggressive depending on product expectations).

---

## 2. Quick Status Dashboard

| Area | Status | Notes | Gap IDs |
|---|---|---|---|
| Auth / Session | **Partially Implemented** | Backend endpoints exist; frontend has token store + `/users/me` restore, but login/signup UI + verification deep link handling not wired | `FE-BE-GAP-003` (staging email config) |
| Identity Flow | **Partially Implemented** | Backend supports signup/login/verify/resend/me; frontend screens are stubs | — |
| API Client / Base URL | **Implemented** | `EXPO_PUBLIC_API_BASE_URL` + root-mounted routes (no `/api/v1`) | — |
| Events | **Unknown / Needs Confirmation** | No confirmed analytics/realtime event contract; backend logs placeholder “notification deferred” events only | `FE-BE-GAP-020`, `FE-BE-GAP-021` |
| Notifications | **Blocked** | No push token registration endpoint; backend notification side effects are placeholders/log-only | `FE-BE-GAP-015`, `FE-BE-GAP-016`, `FE-BE-GAP-020`, `FE-BE-GAP-021` |
| Deep Links | **Partially Implemented** | Backend generates verification deep links per env; frontend declares scheme `companion` only; no confirmed `auth/verify-email` route | (See Open Questions) |
| Environment Config | **Partially Implemented** | Frontend supports base URL + env label; backend exposes `/health` metadata; staging/prod URLs not confirmed | `FE-BE-GAP-025` |

---

## 3. How To Use This Document

- **Frontend agents:** check this contract before assuming an endpoint exists or guessing request/response fields. If you need something missing, register a gap in `technical/frontend-companion/backend-gap-register.md`.
- **Backend agents:** update this contract whenever a mobile-facing endpoint, auth/session behavior, error envelope, deep link scheme, or env var changes.
- **Testing agents:** use this as the source of expectations for API/E2E checks (especially auth, booking/matching/session flows).
- **Gap discipline:** backend gaps belong in the **gap register**; this doc should link to gap IDs rather than “hiding” missing behavior.

---

## 4. Maintenance Rules

Update this document when any of the following changes:

- Backend APIs: paths, methods, request/response shapes, auth requirements
- Auth/session behavior: token TTL, required headers, 401/403 patterns, login throttling
- Error envelope: `{code,message}` shape, validation error behavior
- Deep links: verification link generation, schemes, supported routes
- Notifications: push token registration, providers, payload shapes
- Environment variables that impact frontend behavior or URLs
- Any backend gap is resolved (also update the gap register status + add evidence)

Evidence hierarchy for marking something “Implemented”:
1. Backend route/controller/schema in `technical/backend-companion/src/**`
2. Automated tests or runner artifacts in backend `__tests__` and frontend `e2e/`
3. Milestone docs (useful, but **not proof** on their own)

---

## 5. Status Legend

- **Implemented** — Proven by current code (and ideally tests)
- **Partially Implemented** — Some parts exist, but key pieces are missing/unwired
- **Planned** — Described in milestone docs, but not implemented in code yet
- **Blocked** — Cannot be completed without a dependency (usually a backend gap)
- **Unknown / Needs Confirmation** — Not enough evidence to claim behavior
- **Deprecated** — Exists but should not be used going forward

---

## 6. Frontend-Backend Interaction Map (High-Level)

> This table maps **current frontend areas** (screens/layout/stores) to their backend dependencies.
> Status is about the **end-to-end connection**, not whether a screen file exists.

| Frontend Area | Backend Dependency | Status | Notes |
|---|---|---|---|
| Session restore (`app/index.tsx`) | `GET /users/me` | **Implemented** | Uses SecureStore token; on any error logs out and redirects to login (`technical/frontend-companion/companion-app/app/index.tsx`) |
| Auth routing (`app/(auth)/_layout.tsx`) | Session store only | **Implemented** | Redirects away from auth routes if user is present |
| Client route guard (`app/(client)/_layout.tsx`) | Session store only | **Implemented** | Guards by role; does not yet resolve “next action” state |
| Companion route guard (`app/(companion)/_layout.tsx`) | Session store + local onboarding storage | **Partially Implemented** | Onboarding completion stored locally; no backend onboarding contract yet (`FE-BE-GAP-005` is product decision) |
| Login screen (`app/(auth)/login.tsx`) | `POST /auth/login` | **Planned** | Screen is stub; backend route exists |
| Signup screen (`app/(auth)/signup.tsx`) | `POST /auth/signup` | **Planned** | Screen is stub; backend route exists |
| Email verification deep link handling | `GET /auth/verify-email` (plus deep link) | **Unknown / Needs Confirmation** | Backend generates `companion-*/auth/verify-email?token=...`, but frontend does not implement this route yet |
| Location/Venue search screen | `GET /venues` | **Planned** | Backend requires non-empty `q` query (`FE-BE-GAP-013`) |
| Availability screen | `GET /availability` | **Planned** | Requires `venueId` + `date` |
| Booking create / confirm | `POST /bookings`, `GET /bookings/:id/details` | **Planned / Risky** | Booking details returns `companions: null` until reveal and for terminal states (`FE-BE-GAP-009`, `FE-BE-GAP-022`) |
| Matching screen | `/bookings/:id/*matching*` endpoints | **Planned / Blocked** | Some prerequisites missing (presence arrival endpoint `FE-BE-GAP-017`) |
| In-service screen | `/bookings/:id/session`, `/extend`, `/messages` | **Planned** | Backend endpoints exist; notifications are placeholders (`FE-BE-GAP-020`) |
| Feedback screen | `POST /bookings/:id/rating` | **Planned / Blocked** | Needs read/status + companion info for terminal booking (`FE-BE-GAP-022`, `FE-BE-GAP-023`) |

---

## 7. API Contract Index (Backend Routes)

> “Status” here is about **backend availability**.
> “Used By” distinguishes **actual frontend code usage** vs milestone expectations.

| Domain | Method | Path | Auth Required | Status | Used By | Gap ID / Notes |
|---|---|---|---|---|---|---|
| Health | GET | `/health` | No | Implemented | Frontend Milestone 0 docs + e2e (may be stale) | Returns env + email mode + deep link scheme (see `src/app.ts`) |
| Identity | POST | `/auth/signup` | No | Implemented | Planned (Milestone 2) | Request includes `role`, `name`, `nickname`, `email`, `password` |
| Identity | GET | `/auth/verify-email?token=...` | No | Implemented | Planned | Deep link route in mobile app not wired yet |
| Identity | POST | `/auth/resend-verification` | No | Implemented | `lib/api/auth.ts` | — |
| Identity | POST | `/auth/login` | No | Implemented | `lib/api/auth.ts` (when UI exists) | 429 throttling via rate limiter |
| Identity | GET | `/users/me` | Yes (Bearer) | Implemented | **Used** (session restore) | — |
| Identity | PATCH | `/users/me` | Yes (Bearer) | Implemented | Planned | Update nickname |
| Roster | GET | `/venues?q=...` | Yes (Bearer) | Implemented | Planned | Requires non-empty `q` (`FE-BE-GAP-013`) |
| Roster | GET | `/availability?venueId=...&date=YYYY-MM-DD` | Yes (Bearer) | Implemented | Planned | — |
| Booking | POST | `/bookings` | Yes (CLIENT) | Implemented | Planned | `FE-BE-GAP-014` pricing/duration decision |
| Booking | GET | `/bookings/:id/details` | Yes (CLIENT) | Implemented | Planned | Companion reveal + terminal-state issues: `FE-BE-GAP-009`, `FE-BE-GAP-022` |
| Booking | POST | `/bookings/:id/cancel` | Yes (CLIENT or assigned COMPANION) | Implemented | Planned | — |
| Matching | GET | `/bookings/:bookingId/com-match/context` | Yes (COMPANION) | Implemented | Planned | Blocked without arrival endpoint (`FE-BE-GAP-017`) |
| Matching | POST | `/bookings/:bookingId/com-match/verify` | Yes (COMPANION) | Implemented | Planned | — |
| Matching | GET | `/bookings/:bookingId/matching/context` | Yes | Implemented | Planned | Provides QR/PIN + `bookingColor` |
| Matching | POST | `/bookings/:bookingId/client-match/start` | Yes (CLIENT) | Implemented | Planned | Requires GPS flags; can error GPS_* codes |
| Matching | POST | `/bookings/:bookingId/client-match/verify` | Yes (COMPANION) | Implemented | Planned | — |
| Matching | POST | `/bookings/:bookingId/matching/location` | Yes | Implemented | Planned | Location update endpoint |
| Session | PATCH | `/bookings/:id/extend` | Yes (CLIENT) | Implemented | Planned | — |
| Session | POST | `/bookings/:id/sos` | Yes | Implemented (stub) | Planned | SOS has no side effects (stub) |
| Session | GET | `/bookings/:id/session` | Yes | Implemented | Planned | — |
| Session | GET | `/bookings/:id/messages` | Yes (COMPANION) | Implemented | Planned | — |
| Session | POST | `/bookings/:id/messages` | Yes (COMPANION) | Implemented | Planned | Body: `{ content }` only |
| Ratings | POST | `/bookings/:id/rating` | Yes | Implemented | Planned | Missing read/status endpoint: `FE-BE-GAP-023` |
| Companion Profile | GET | `/companion-profiles/me` | Yes (COMPANION) | Implemented | Planned | — |
| Companion Profile | POST | `/companion-profiles/upload-picture` | Yes (COMPANION) | Implemented | Planned | Multipart field name: `picture` (`FE-BE-GAP-026` prod storage) |
| Companion Profile | PATCH | `/companion-profiles/me` | Yes (COMPANION) | Implemented | Planned | Update `languages`/`profilePictureUrl` |
| Companion Profile | PATCH | `/companion-profiles/toggle-active` | Yes (COMPANION) | Implemented | Planned | — |
| Internal (Roster) | POST | `/roster-slots/reserve` | Internal header | Implemented | Backend-only | Internal auth header name mismatch needs confirmation |
| Internal (Roster) | POST | `/roster-slots/release` | Internal header | Implemented | Backend-only | Internal auth header name mismatch needs confirmation |
| Internal (Roster) | POST | `/roster-slots/populate-for-companion` | Internal header | Implemented | Backend-only | Triggered during companion signup provisioning |
| Internal (Booking) | PATCH | `/bookings/:id` | Internal header | Implemented | Backend-only | Internal edit |

---

## 8. Detailed API Contracts

> Error envelope: `{ code: string, message: string }` (see `technical/backend-companion/src/shared/middleware/errorHandler.ts`).

### Health: Health Check

**Status:** Implemented  
**Method:** GET  
**Path:** `/health`  
**Purpose:** Smoke-check backend availability + expose environment metadata for frontend setup/debug.  
**Auth Required:** No  
**Used By Frontend:** Planned/previous Milestone 0 UI + tests; backend endpoint exists now.  
**Backend Source:** `technical/backend-companion/src/app.ts`  

**Request Body:** None

**Success Response (200):**
```json
{
  "status": "ok",
  "appEnv": "local|dev|staging|production",
  "verificationDeepLinkScheme": "companion-dev://|companion-staging://|companion://",
  "emailDeliveryMode": "smtp|disabled|log_only"
}
```

**Error Responses:**
- 500 `{ code: "INTERNAL_ERROR", message: "Internal server error" }` (generic)

**Frontend Behavior:**
- Should treat this as a connectivity/env-debug endpoint only (not a security boundary).

**Test Coverage:**
- Frontend Playwright “Milestone 0” suite expects a UI-driven `/health` check (`technical/frontend-companion/companion-app/e2e/tests/milestone-0.spec.ts`) — **may be out of sync** with current app routes.

**Gap / Unknowns:**
- If frontend relies on this for env config, confirm how it’s surfaced in current UI.

---

### Identity: Signup

**Status:** Implemented (backend), Planned (frontend UI)  
**Method:** POST  
**Path:** `/auth/signup`  
**Purpose:** Create a user account; send verification email (delivery depends on env).  
**Auth Required:** No  
**Used By Frontend:** Planned (Milestone 2)  
**Backend Source:**
- Route: `technical/backend-companion/src/modules/identity/identity.route.ts`
- Schema: `technical/backend-companion/src/modules/identity/identity.schema.ts`
- Service: `technical/backend-companion/src/modules/identity/identity.service.ts`

**Request Body:**
```json
{
  "role": "CLIENT" | "COMPANION",
  "name": "...",
  "nickname": "...",
  "email": "...",
  "password": "...",
  "biometricAuthEnabled": false
}
```

**Success Response (201):** `PublicUserDTO`
```json
{
  "id": "uuid",
  "role": "CLIENT|COMPANION",
  "name": "...",
  "nickname": "...",
  "email": "...",
  "emailVerified": false,
  "biometricAuthEnabled": false,
  "createdAt": "ISO timestamp",
  "companionProfile": {
    "id": "uuid",
    "userId": "uuid",
    "designation": "CAPTAIN|VICE_CAPTAIN",
    "isActive": false,
    "languages": [],
    "profilePictureUrl": "",
    "averageRating": 0
  }
}
```
> `companionProfile` is only present for `role=COMPANION` (see `identity.service.ts`).

**Error Responses (examples):**
- 400 `VALIDATION_ERROR`
- 409 `EMAIL_ALREADY_EXISTS`
- 500 `INTERNAL_ERROR`

**Frontend Behavior:**
- After signup, user likely must verify email before login is allowed.

**Test Coverage:**
- Backend: `technical/backend-companion/src/modules/identity/__tests__/identity.service.test.ts`

**Gap / Unknowns:**
- Staging email delivery is intentionally “log_only” by default (`FE-BE-GAP-003`).

---

### Identity: Verify Email

**Status:** Implemented (backend), Unknown/Planned (frontend deep link routing)  
**Method:** GET  
**Path:** `/auth/verify-email?token=...`  
**Purpose:** Mark user email as verified using a JWT-like token.  
**Auth Required:** No  
**Used By Frontend:** Planned (Milestone 2)  
**Backend Source:**
- Route: `technical/backend-companion/src/modules/identity/identity.route.ts`
- Service: `technical/backend-companion/src/modules/identity/identity.service.ts`
- Deep link builder: `technical/backend-companion/src/shared/utils/urls.ts`

**Request Body:** None

**Success Response (200):**
```json
{ "status": "VERIFIED" }
```

**Error Responses (examples):**
- 400 `VALIDATION_ERROR` (missing/invalid token query)
- 401 `TOKEN_EXPIRED` / `TOKEN_INVALID`

**Frontend Behavior:**
- Backend emails include a deep link like: `companion-dev://auth/verify-email?token=<encoded>`.
- **Frontend currently does not implement an `auth/verify-email` route**, so this must be wired before real device verification works.

**Test Coverage:**
- Backend: `technical/backend-companion/src/shared/utils/__tests__/urls.test.ts` (deep link generation)

**Gap / Unknowns:**
- Confirm final mobile deep link scheme(s) used per environment build.

---

### Identity: Login

**Status:** Implemented (backend), Planned (frontend UI), Partially Implemented (session restore path)  
**Method:** POST  
**Path:** `/auth/login`  
**Purpose:** Exchange credentials for an access token and user profile.  
**Auth Required:** No  
**Used By Frontend:** Helper exists (`technical/frontend-companion/companion-app/lib/api/auth.ts`), but UI is stub.  
**Backend Source:**
- Route: `technical/backend-companion/src/modules/identity/identity.route.ts` (rate limiter)
- Schema: `technical/backend-companion/src/modules/identity/identity.schema.ts`
- Service: `technical/backend-companion/src/modules/identity/identity.service.ts`

**Request Body:**
```json
{ "email": "...", "password": "..." }
```

**Success Response (200):**
```json
{
  "accessToken": "...",
  "tokenType": "Bearer",
  "expiresInSeconds": 3600,
  "user": { /* PublicUserDTO */ }
}
```

**Error Responses (examples):**
- 400 `VALIDATION_ERROR`
- 401 `INVALID_CREDENTIALS`
- 403 `EMAIL_NOT_VERIFIED`
- 429 `TOO_MANY_ATTEMPTS`

**Frontend Behavior:**
- Store token in SecureStore; set `Authorization: Bearer <token>` for future requests.

**Test Coverage:**
- Backend: `technical/backend-companion/src/modules/identity/__tests__/identity.service.test.ts`

**Gap / Unknowns:**
- No refresh-token contract exists (see Auth & Session Contract section).

---

### Identity: Get Current User

**Status:** Implemented (backend + frontend usage)  
**Method:** GET  
**Path:** `/users/me`  
**Purpose:** Validate token + return current user profile for session restoration.  
**Auth Required:** Yes (`Authorization: Bearer <accessToken>`)  
**Used By Frontend:** **Yes** (`technical/frontend-companion/companion-app/app/index.tsx`)  
**Backend Source:**
- Route: `technical/backend-companion/src/modules/identity/identity.route.ts`
- Auth middleware: `technical/backend-companion/src/shared/middleware/auth.ts`

**Request Body:** None

**Success Response (200):** `PublicUserDTO` (see Signup section)

**Error Responses (examples):**
- 401 `UNAUTHORIZED` / `TOKEN_INVALID` / `TOKEN_EXPIRED`
- 404 `USER_NOT_FOUND`

**Frontend Behavior:**
- On *any* error during restore (including network/timeout), frontend clears token and routes to login (`app/index.tsx`).

**Test Coverage:**
- Backend: `technical/backend-companion/src/modules/identity/__tests__/identity.service.test.ts`

**Gap / Unknowns:**
- Confirm whether “network error should log out” is desired product behavior.

---

### Roster: Venue Search

**Status:** Implemented (backend), Planned (frontend usage)  
**Method:** GET  
**Path:** `/venues?q=...`  
**Purpose:** Search venues before booking.  
**Auth Required:** Yes  
**Used By Frontend:** Planned (Milestone 4)  
**Backend Source:**
- Route: `technical/backend-companion/src/modules/roster/roster.route.ts`
- Schema: `technical/backend-companion/src/modules/roster/roster.schema.ts`
- Types: `technical/backend-companion/src/modules/roster/roster.types.ts`

**Request (Query):**
- `q` (string, **required**, non-empty)

**Success Response (200):**
```json
{ "items": [ { "id": "uuid", "name": "...", "address": "...", "venueType": "...", "latitude": 0, "longitude": 0, "operatingHoursStart": "...", "operatingHoursEnd": "..." } ] }
```

**Error Responses (examples):**
- 400 `VALIDATION_ERROR`
- 401 `UNAUTHORIZED` / `TOKEN_*`

**Frontend Behavior:**
- Because empty `q` is not allowed, the UI must either:
  - require user input before search, or
  - backend must be changed to support empty/default lists.

**Test Coverage:**
- Backend: `technical/backend-companion/src/modules/roster/__tests__/roster.service.test.ts`

**Gap / Unknowns:**
- `FE-BE-GAP-013` (empty/default venue list behavior)
- `FE-BE-GAP-010` (missing `GET /venues/:venueId`)

---

### Roster: Availability

**Status:** Implemented (backend), Planned (frontend usage)  
**Method:** GET  
**Path:** `/availability?venueId=...&date=YYYY-MM-DD`  
**Purpose:** Return available start times (currently for fixed 2-hour windows).  
**Auth Required:** Yes  
**Backend Source:** `technical/backend-companion/src/modules/roster/*`  

**Request (Query):**
- `venueId` (uuid)
- `date` (`YYYY-MM-DD`)

**Success Response (200):**
```json
{
  "venueId": "uuid",
  "date": "YYYY-MM-DD",
  "durationMinutes": 120,
  "availableStartTimes": ["ISO timestamp", "..."]
}
```

**Gap / Unknowns:**
- Confirm timezone expectations for `availableStartTimes`.

---

### Booking: Create Booking

**Status:** Implemented (backend), Planned (frontend usage)  
**Method:** POST  
**Path:** `/bookings`  
**Purpose:** Create a booking and allocate a companion duo.  
**Auth Required:** Yes (CLIENT role enforced)  
**Backend Source:** `technical/backend-companion/src/modules/booking/*`  

**Request Body:**
```json
{ "venueId": "uuid", "startAt": "ISO timestamp" }
```

**Success Response (201):**
```json
{ "id": "uuid", "status": "CONFIRMED", "clientId": "uuid", "venueId": "uuid", "startAt": "...", "endAt": "...", "createdAt": "..." }
```

**Error Responses (examples):**
- 401/403 auth/role
- 404 `VENUE_NOT_FOUND`
- 409 `CLIENT_ALREADY_HAS_NON_TERMINAL_BOOKING`
- 409 `NO_DUO_AVAILABLE`

**Gap / Unknowns:**
- `FE-BE-GAP-014` (pricing/packages/duration vs fixed 2-hour implementation)

---

### Booking: Booking Details

**Status:** Implemented (backend), Risky for frontend usage (known mismatch)  
**Method:** GET  
**Path:** `/bookings/:id/details`  
**Purpose:** Fetch booking details and (sometimes) companion public info.  
**Auth Required:** Yes (CLIENT only)  
**Backend Source:** `technical/backend-companion/src/modules/booking/booking.service.ts`  

**Success Response (200):**
```json
{
  "id": "uuid",
  "status": "CONFIRMED|ACTIVE|COMPLETED|CANCELLED",
  "clientId": "uuid",
  "venueId": "uuid",
  "startAt": "ISO timestamp",
  "endAt": "ISO timestamp",
  "createdAt": "ISO timestamp",
  "companions": [
    {
      "designation": "CAPTAIN|VICE_CAPTAIN",
      "displayName": "...",
      "languages": ["ENGLISH"],
      "profilePictureUrl": "...",
      "averageRating": 4.8
    }
  ] | null
}
```

**Important behavior (implemented):**
- `companions` is **null** until the “reveal window” unlocks (`T-5h` before `startAt`) and is also **null** for `CANCELLED` and `COMPLETED` statuses.
  - Evidence: `COMPANION_REVEAL_WINDOW_MS` and `statusBlocksReveal` in `booking.service.ts`.

**Gap / Unknowns:**
- `FE-BE-GAP-009` (SDS expects always-present companion info)
- `FE-BE-GAP-011` (booking companion public info lacks a `companionId` field)
- `FE-BE-GAP-022` (terminal states need companion info for feedback)

---

### Booking: Cancel Booking

**Status:** Implemented (backend), Planned (frontend usage)  
**Method:** POST  
**Path:** `/bookings/:id/cancel`  
**Purpose:** Cancel a booking (client owner or assigned companion only).  
**Auth Required:** Yes  

**Success Response (200):**
```json
{ "id": "uuid", "status": "CANCELLED" }
```

**Error Responses (examples):**
- 403 `FORBIDDEN` / `COMPANION_NOT_ASSIGNED`
- 404 `BOOKING_NOT_FOUND`
- 400 `INVALID_STATE_TRANSITION` (e.g. completed)

---

### Matching: Matching Context

**Status:** Implemented (backend), Planned/Blocked (frontend end-to-end)  
**Method:** GET  
**Path:** `/bookings/:bookingId/matching/context`  
**Purpose:** Provide matching state for client or companions.

**Success Response (200):** one of:
- Client view:
```json
{
  "bookingId": "uuid",
  "bookingStatus": "CONFIRMED|ACTIVE|COMPLETED|CANCELLED",
  "bookingColor": "...",
  "companions": [{"id":"uuid","displayName":"...","languages":[],"averageRating":0,"profilePictureUrl":"..."}],
  "companionLocations": [{"companionId":"uuid","latitude":0,"longitude":0,"updatedAt":"..."}],
  "qrCode": "...",
  "pinCode": "...",
  "clientMatchStarted": true
}
```
- Companion view:
```json
{
  "bookingId": "uuid",
  "bookingStatus": "...",
  "bookingColor": "...",
  "clientNickname": "...",
  "clientMatchStarted": false,
  "canVerifyClientMatch": true,
  "clientLocation": {"latitude":0,"longitude":0,"updatedAt":"..."}
}
```

**Known blockers / gaps:**
- `FE-BE-GAP-017` (presence arrival endpoint needed before com-match proceeds)
- `FE-BE-GAP-018` (client message/location input is product decision)
- `FE-BE-GAP-019` (color signal action semantics)

---

### Session In Progress: Session + Messages

**Status:** Implemented (backend), Planned (frontend wiring)  
**Endpoints:**
- `GET /bookings/:id/session`
- `PATCH /bookings/:id/extend` (CLIENT)
- `GET/POST /bookings/:id/messages` (COMPANION)

**Notable contract detail:**
- Create message body must include only `{ content }` — schema explicitly rejects `senderUserId`.
  - Evidence: `createBookingMessageSchema` in `technical/backend-companion/src/modules/session-in-progress/session-in-progress.schema.ts`

**Notifications note:**
- Near-end notifications and breach alerts are **scheduler placeholders** that only log events.
  - Evidence: `session-in-progress.schedulers.ts` logs `BOOKING_NEAR_END_NOTIFICATION` and placeholder alerts.
  - Gaps: `FE-BE-GAP-020`, `FE-BE-GAP-021`.

---

### Ratings: Create Booking Rating

**Status:** Implemented (backend), Planned (frontend wiring)  
**Method:** POST  
**Path:** `/bookings/:id/rating`  
**Auth Required:** Yes  

**Request Body:**
```json
{ "stars": 5, "tags": ["..."] , "comment": "..." }
```

**Success Response:**
- Status `201` or `200` (backend may return existing rating)
- Body: `BookingRatingDTO`

**Gap / Unknowns:**
- `FE-BE-GAP-023` (no read endpoint for rating status)
- `FE-BE-GAP-024` (product decision: negative tags set)

---

### Companion Profile: Upload Picture

**Status:** Implemented (backend), Planned (frontend wiring)  
**Method:** POST  
**Path:** `/companion-profiles/upload-picture`  
**Auth Required:** Yes (COMPANION)  

**Request Body:** multipart/form-data
- field name: `picture`
- mime types allowed: `image/jpeg` or `image/png`
- max size: 5MB

**Success Response (200):**
```json
{ "profilePictureUrl": "http(s)://<PUBLIC_BASE_URL>/uploads/profiles/<userId>/picture_<ts>.jpg" }
```

**Backend Source:**
- Upload middleware: `technical/backend-companion/src/modules/companion-profile/companion-profile.upload.ts`
- Static hosting: `app.use("/uploads", express.static(...))` in `technical/backend-companion/src/app.ts`

**Gap / Unknowns:**
- `FE-BE-GAP-026` (production-safe storage TBD)

---

## 9. Authentication And Session Contract

### What is implemented (evidence)

**Frontend:**
- Stores token in `expo-secure-store` under key `auth_token` (`technical/frontend-companion/companion-app/store/session.ts`).
- Adds `Authorization: Bearer <token>` header automatically when token set (`lib/api-client.ts`).
- Session restore flow:
  - Reads token from SecureStore.
  - Calls `GET /users/me`.
  - If success: stores user+token in Zustand and routes based on role.
  - If *any* error: clears token and routes to login.
  - Evidence: `technical/frontend-companion/companion-app/app/index.tsx`.

**Backend:**
- Requires `Authorization` header for protected routes; expects `Bearer <token>`.
  - Evidence: `technical/backend-companion/src/shared/middleware/auth.ts`.
- Access token TTL is `AUTH_ACCESS_TOKEN_TTL` (default 3600s).
  - Evidence: `technical/backend-companion/src/shared/config/index.ts`.
- Token failure errors:
  - `TOKEN_EXPIRED` (401)
  - `TOKEN_INVALID` (401)
  - Evidence: `technical/backend-companion/src/shared/utils/jwt.ts`.

### What is missing

- **No refresh token / refresh endpoint exists** in backend code.
- **No backend logout endpoint** exists (frontend logout is purely client-side token deletion).

### Unknown / needs confirmation

- Whether the frontend should log out on **network errors** during restore (currently it does).
- Whether backend expects any “session invalidation” beyond JWT expiry.

---

## 10. Error Contract

### Backend error envelope (implemented)

Backend returns JSON errors in this shape:
```json
{ "code": "SOME_ERROR_CODE", "message": "Human-readable message" }
```
Evidence: `technical/backend-companion/src/shared/middleware/errorHandler.ts`

### Validation errors

- Zod failures become:
  - Status: 400
  - Body: `{ code: "VALIDATION_ERROR", message: "Invalid input" }`

### Auth errors

- Missing Authorization header: 401 `{ code: "UNAUTHORIZED", message: "Missing authorization" }`
- Invalid/expired token: 401 `{ code: "TOKEN_INVALID"|"TOKEN_EXPIRED", message: "..." }`

### Frontend error handling (implemented)

- Frontend `ApiClient` throws `AppApiError(code, message, status)` when `res.ok` is false.
- If response is not JSON, it falls back to `{ code: 'UNKNOWN_ERROR', message: 'HTTP <status>' }`.

**Important note:** The frontend currently treats any error during restore as “expired session” and logs out.

---

## 11. Environment Contract

### Frontend environment variables (implemented)

From `technical/frontend-companion/companion-app/lib/config.ts`:
- `EXPO_PUBLIC_API_BASE_URL` (default `http://localhost:3000`)
- `EXPO_PUBLIC_ENV` (`local|staging|production`, default `local`)

### Backend environment variables that affect frontend

From `technical/backend-companion/src/shared/config/index.ts` and `.env.example`:
- `PORT` — impacts API base URL
- `PUBLIC_BASE_URL` — used to build public URLs for uploads
- `WEB_VERIFY_URL` — web verification URL template containing `{token}`
- `MOBILE_DEEPLINK_SCHEME` — overrides the default deep link scheme
- `APP_ENV` — determines default deep link scheme and email delivery mode
- `EMAIL_DELIVERY_MODE` — `smtp|disabled|log_only` (staging defaults to `log_only`)
- `CORS_ALLOWED_ORIGINS` — enables Expo web dev to call backend (gap `FE-BE-GAP-002` resolved)

### Confirmed local dev URLs

- Backend default: `http://localhost:3000` (see `.env.example`)
- Health check: `GET http://localhost:3000/health`

### Unknown / Needs Confirmation

- Staging/prod deployed API base URLs and HTTPS requirements: `FE-BE-GAP-025`.

---

## 12. Events Contract

**No confirmed analytics or realtime event contract yet.**

What *does* exist (backend evidence):
- Backend logs placeholder “notification deferred” events during booking/matching flows.
- Session schedulers log placeholder near-end and breach events.

This is **not** a frontend-consumable event contract.

---

## 13. Notifications Contract

**No confirmed notification contract yet.**

Backend evidence shows:
- No push token registration endpoint.
- Notification side effects are placeholders/log-only.

Relevant gaps:
- `FE-BE-GAP-015`, `FE-BE-GAP-016`, `FE-BE-GAP-020`, `FE-BE-GAP-021`

---

## 14. Deep Link Contract

### Backend-generated verification deep links (implemented)

- Backend builds deep link: `<scheme>auth/verify-email?token=<encoded>`
- Default schemes by `APP_ENV`:
  - local/dev → `companion-dev://`
  - staging → `companion-staging://`
  - production → `companion://`
  - Evidence: `technical/backend-companion/src/shared/config/index.ts`

### Frontend app scheme (implemented)

- Expo scheme is currently: `companion` (see `technical/frontend-companion/companion-app/app.json`).

### Missing / Unknown

- Frontend does not yet define a route/handler for `auth/verify-email`.
- Frontend does not yet show environment-specific schemes (`companion-dev`, `companion-staging`) in `app.json`.

**Needs confirmation:** whether environment-specific scheme changes will be implemented via build profiles, config plugin, or a move to `app.config.ts`.

---

## 15. File / Upload Contract

### Confirmed upload (backend)

- Profile picture upload (COMPANION): `POST /companion-profiles/upload-picture` (multipart field `picture`)
- Static hosting: `/uploads/**`

### Unknown / Needs Confirmation

- Any other file uploads/downloads beyond profile picture.

---

## 16. Mock And Workaround Register (Frontend)

| Frontend Mock / Workaround | Location | Reason | Related Gap | Removal Condition |
|---|---|---|---|---|
| Placeholder “Coming soon” actions | `technical/frontend-companion/companion-app/lib/placeholder-action.ts` | Non-core buttons can be stubbed while core flows are implemented | — | Replace when feature becomes part of milestone scope |
| Placeholder screens for most routes | `technical/frontend-companion/companion-app/app/(client)/**` | Milestone 2+ features not wired yet | Multiple | Replace per milestone implementation |
| Onboarding completion stored locally | `lib/onboarding-storage.ts` | Onboarding media/hosting contract not finalized | `FE-BE-GAP-005` | Replace when onboarding content source is decided |

---

## 17. Milestone Usage Map

> Milestone docs are planning aids, not proof. This table explains which contract areas each milestone is expected to touch.

| Milestone | Contract Areas Used | Backend Dependencies | Gap IDs / Notes |
|---|---|---|---|
| 0 — Real Device Placeholder | API base URL, `/health` | `GET /health` | `FE-BE-GAP-001` resolved; frontend E2E may be stale |
| 1 — Core Foundation | API client, env config, token storage | `GET /health`, `GET /users/me` | `FE-BE-GAP-003` staging email config |
| 2 — Identity Flow | signup/login/verify/resend | `/auth/*`, `/users/me` | Deep link wiring still missing in frontend |
| 3 — Backend-driven home | “current state” routing | (missing) | `FE-BE-GAP-006`, `FE-BE-GAP-007`, `FE-BE-GAP-008` |
| 4 — Booking flow | venues, availability, bookings | `/venues`, `/availability`, `/bookings*` | `FE-BE-GAP-009`…`FE-BE-GAP-014` |
| 5 — Native capabilities | push + deep links | (missing push APIs) | `FE-BE-GAP-015`, `FE-BE-GAP-016` |
| 6 — Matching | matching context + verify | `/bookings/:id/*matching*` | `FE-BE-GAP-017`…`FE-BE-GAP-019` |
| 7 — Active session | session + messages + extend | `/bookings/:id/session`, `/extend`, `/messages` | `FE-BE-GAP-020`, `FE-BE-GAP-021` |
| 8 — Ratings | ratings post + routing | `/bookings/:id/rating` | `FE-BE-GAP-022`…`FE-BE-GAP-024` |
| 9 — Release hardening | staging/prod env + data | deployed URLs + seed | `FE-BE-GAP-025`…`FE-BE-GAP-027` |

---

## 18. Open Questions

### Auth / Session
- Should the app log out on **network errors** during session restore, or only on 401/403?
- Is there any planned refresh-token flow, or is “re-login when expired” the V1 plan?

### APIs
- What is the expected “current state” endpoint contract (single endpoint vs multiple lookups)? (`FE-BE-GAP-006`)
- Should `/venues` support empty search / default list? (`FE-BE-GAP-013`)
- Should booking details always include companion info, or is reveal behavior intentional? (`FE-BE-GAP-009`)

### Events
- Are there any frontend-consumed realtime events planned (websockets/SSE), or is polling the V1 approach?

### Notifications
- What push provider is planned and what is the token registration API? (`FE-BE-GAP-015`, `FE-BE-GAP-016`)

### Environment
- What are the staging/prod base URLs and how will they be surfaced to Expo builds? (`FE-BE-GAP-025`)
- How will environment-specific deep link schemes be configured in the mobile app builds?

### Testing
- Frontend Playwright “Milestone 0” tests reference UI elements that may not exist anymore — should they be updated or retired?

### Product decisions
- Onboarding media source (backend-hosted vs bundled) (`FE-BE-GAP-005`)
- Pricing/packages/duration meaning in V1 (`FE-BE-GAP-014`)

---

## 19. Change Log

| Date | Change | Evidence Used |
|---|---|---|
| 2026-05-10 | Initial contract document created | Backend routes/controllers/schemas under `technical/backend-companion/src/**`; frontend API client/session store under `technical/frontend-companion/companion-app/**`; gap register `technical/frontend-companion/backend-gap-register.md`; milestone docs under `technical/frontend-companion/milestones/**` |
