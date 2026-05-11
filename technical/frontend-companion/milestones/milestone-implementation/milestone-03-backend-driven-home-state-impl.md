# Milestone 3: Backend-Driven Home State — Implementation Document

**Created:** 2026-05-11

**Milestone:** 3 — Backend-Driven Home State

**Status:** Implementation Ready

**Output File:** `technical/frontend-companion/milestones/milestone-implementation/milestone-03-backend-driven-home-state-impl.md`

**Sources inspected:**
- `technical/frontend-companion/milestones/milestone-03-backend-driven-home-state.md`
- `technical/mobile-frontend-roadmap.md`
- `technical/frontend-companion/frontend-backend-contract.md`
- `technical/frontend-companion/backend-gap-register.md`
- Prior implementation docs:
  - `technical/frontend-companion/milestones/milestone-implementation/milestone-01-core-app-foundation.md`
  - `technical/frontend-companion/milestones/milestone-implementation/milestone-02-identity-flow-minimum-ui-impl.md`

---

## Scope Summary

Milestone 3 builds a **backend-driven state resolver** so that after login (and after app resume) the app can reliably determine what the user should do next and route accordingly.

This milestone is **logic-first**:
- The UI is minimum / placeholder.
- The core deliverable is correct **routing based on backend-authoritative state**, not polished screens.

The milestone must support both roles:
- CLIENT: `no booking` → home, `confirmed booking`, `matching needed`, `active session`, `rating needed`
- COMPANION: `inactive`, `active but no assignment`, `assigned booking`, `matching needed`, `active session`, `rating needed`

---

## Out of Scope

- Final home UI design polish (Milestone 10)
- Full wallet features (placeholder only)
- Non-core profile actions (placeholder only)
- Any “manual booking id entry” or “seeded-only routing” as a final behavior (explicitly disallowed by Milestone 3 Done Means)

---

## Clarity Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Should Milestone 3 proceed with frontend fallbacks for missing backend state APIs? | No. Implement the missing backend APIs in this milestone. No frontend fallbacks/workarounds. |
| 2 | Can a user have multiple “relevant” bookings at the same time (requires selection rules)? | Product invariant: **no** — the system should never create a situation where a client or companion has multiple “relevant” bookings/assignments at once. Backend should enforce this invariant. If it is ever violated due to a bug, the `/users/me/app-state` implementation must still return a deterministic result (and log a warning) rather than crashing. |

---

## Backend Dependencies (Milestone 3)

Milestone 3 depends on implementing the following backend gaps:
- `FE-BE-GAP-006` — Current user booking / next action endpoint
- `FE-BE-GAP-007` — Assigned companion current booking lookup
- `FE-BE-GAP-008` — Rating submitted / rating needed state lookup

Note: the gap register currently labels `FE-BE-GAP-008` as **Needed Soon** (with a local workaround), but this implementation document intentionally treats it as **required for Milestone 3** so the home state can remain backend-authoritative across reinstall/multi-device.

This implementation document assumes **these gaps are implemented** during Milestone 3.

---

## Backend API Contract (Implemented) — App State + Rating Status

Milestone 3 routing is enabled by two backend endpoints (both already implemented in code on this branch):

### 1) `GET /users/me/app-state` (primary routing input)

**Path:** `/users/me/app-state`

**Auth Required:** Yes (`Authorization: Bearer <accessToken>`)

**Purpose:** Return minimal user info + deterministic primary booking + rating-needed booking + computed `nextAction` for backend-driven home routing.

**Success Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "role": "CLIENT|COMPANION",
    "companionProfile": { "isActive": true } | null
  },
  "primaryBooking": {
    "id": "uuid",
    "status": "ACTIVE|CONFIRMED",
    "startAt": "ISO timestamp",
    "endAt": "ISO timestamp"
  } | null,
  "ratingNeeded": {
    "bookingId": "uuid",
    "status": "COMPLETED|CANCELLED",
    "startAt": "ISO timestamp"
  } | null,
  "nextAction": "ACTIVE_SESSION|MATCHING|RATING_NEEDED|COMPANION_INACTIVE|IDLE"
}
```

**Notable behavior:**
- `primaryBooking` selection is deterministic (ACTIVE > CONFIRMED; then `startAt` asc; then `id` asc).
- `ratingNeeded` represents an eligible terminal booking missing a rating; cancelled bookings are only eligible when `startAt <= dbNow`.
- The response avoids PII (no name/email).

### 2) `GET /bookings/:id/rating-status` (per-booking read)

**Path:** `/bookings/:id/rating-status`

**Auth Required:** Yes

**Purpose:** Return eligibility + submitted/needed status for a specific booking for the authenticated caller.

**Success Response (200):**
```json
{
  "bookingId": "uuid",
  "callerUserId": "uuid",
  "callerRole": "CLIENT|COMPANION",
  "ratingType": "CLIENT_RATING_DUO|COMPANION_RATING_CLIENT",
  "eligibleForRating": true,
  "eligibilityReason": "COMPLETED|CANCELLED_STARTED|CANCELLED_NOT_STARTED|STATUS_NOT_ELIGIBLE",
  "hasSubmitted": false,
  "ratingId": null,
  "ratingCreatedAt": null,
  "ratingNeeded": true
}
```

---

## Backend Implementation Work Units (Now Implemented)

These are the backend changes Milestone 3 requires (already landed in code):

1. Implement `GET /users/me/app-state` in Identity module
   - deterministic primary booking selection for CLIENT + COMPANION
   - rating-needed lookup for CLIENT + COMPANION
   - compute `nextAction` for routing (ACTIVE_SESSION > MATCHING > RATING_NEEDED > IDLE; plus COMPANION_INACTIVE)

2. Implement `GET /bookings/:id/rating-status` in Ratings module
   - enforce authorization (client owner OR assigned companion)
   - return eligibility + submission state

3. Mark backend gaps as resolved in docs (already done by the applied commit)
   - `FE-BE-GAP-006`, `FE-BE-GAP-007`, `FE-BE-GAP-008`

---

## Frontend Implementation Work Units

### 1) Add an App State API client

- Add a frontend API helper (e.g. `lib/api/app-state.ts`) to call `GET /users/me/app-state`.
- Define a strict type for the response `AppStateResponse`.
- (Optional) Add `lib/api/ratings.ts` helper for `GET /bookings/:id/rating-status` if the UI needs per-booking detail beyond `ratingNeeded`.

### 2) Implement a lightweight frontend state resolver

- Add a small module that maps backend `nextAction` (plus `user.role` and `companionProfile.isActive`) to:
  - the correct next route
  - any minimum UI messaging on home

Example route mapping (illustrative):
- `nextAction=IDLE` + role=CLIENT → `/(client)/home`
- `nextAction=MATCHING` → `/(client)/matching` or `/(companion)/matching` (based on role)
- `nextAction=ACTIVE_SESSION` → `/(client)/in-service` or `/(companion)/in-service`
- `nextAction=RATING_NEEDED` → `/(client)/feedback` or `/(companion)/feedback`
- `nextAction=COMPANION_INACTIVE` → `/(companion)/home` (inactive messaging)

Use `primaryBooking` / `ratingNeeded.bookingId` when downstream screens require a booking id.

### 3) Refresh and re-route after login

- After successful login, fetch `GET /users/me/app-state` and route immediately based on `nextAction`.

### 4) Refresh and re-route on app resume

- Add an app-resume hook (AppState foreground transition) that re-fetches `GET /users/me/app-state` and re-routes if needed.

### 5) Minimum home UI + placeholders

- Implement minimum Client and Companion home UI:
  - A clear “Book companions” entry point for client that starts Milestone 4 booking flow
  - Placeholder actions/tabs: Wallet, Profile, Your companions, Share companions, About Companions, notification details

---

## Validation Plan

### Web / simulator validation

1. Login as CLIENT with no booking → `GET /users/me/app-state` returns `nextAction=IDLE` → routes to Client home and shows “Book companions”.
2. Set up backend seed/state so CLIENT `GET /users/me/app-state` yields:
   - `nextAction=MATCHING` (+ `primaryBooking`) → routes to matching
   - `nextAction=ACTIVE_SESSION` → routes to in-service
   - `nextAction=RATING_NEEDED` (+ `ratingNeeded.bookingId`) → routes to feedback
3. Repeat equivalent checks for COMPANION:
   - `nextAction=COMPANION_INACTIVE` → routes to companion home (inactive messaging)
   - `nextAction=IDLE` with COMPANION role → routes to companion home (active/no assignment)
   - `nextAction=MATCHING|ACTIVE_SESSION|RATING_NEEDED` as applicable
4. Confirm that **no manual booking id entry** is required anywhere.

### Real device validation

1. Background the app while logged in, then foreground it → app refreshes and routes correctly.
2. Run one CLIENT landing-state smoke test.
3. Run one COMPANION landing-state smoke test (if Companion flow is active).
