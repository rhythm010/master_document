Feature: Booking & Allocation
Version: 2.0.0
Status: Current
Previous Version: booking-and-allocation.feature-sds.v1.2.0.md
Change Type: MAJOR
Change Summary: Remove timed companion reveal entirely; update GET /bookings/{id}/details to always return companion public info (2 companions, ordered CAPTAIN then VICE_CAPTAIN) for all booking statuses.
Created At: 2026-04-24T03:10:02Z
Last Edited At: 2026-04-29T15:16:52Z
Owner: Booking & Allocation Module

Feature: Booking & Allocation
Module: Booking & Allocation

1. Purpose

Implement booking creation and allocation of a companion duo (Captain + Vice Captain) from a venue-based roster, enforce the "one non-terminal booking per client" rule, support cancellation (pre-session and in-session) with roster release, and provide client-only booking details retrieval with always-available companion public info (no timed reveal).

Additionally, support INTERNAL ONLY edits of an existing booking in CONFIRMED state to:
- change `venueId` and/or `startAt` (with fixed duration), and
- optionally reassign the companion duo (CAPTAIN + VICE_CAPTAIN)
while keeping booking artifacts stable.

Dependencies / Assumptions:
- Venue selection and availability/time-slot selection are handled upstream (separate CDC). This module expects `venueId` and `startAt` to be provided from those pages and treats missing/invalid values as a request validation error.
- In this version, server-side validation for “startAt is in the future” and “within venue operating hours” is not enforced here; upstream availability only returns valid future slots.
- Venues & Availability module owns roster slot population/backfill. Roster slots for the coming week are created for each companion at signup and backfilled if missing (see Constraints).
- Admin reassignment via client-facing/admin Bearer authorization is deferred; reassignment is supported only via the internal edit endpoint `PATCH /bookings/{id}` with internalAuth.

Source: `master-document/1.2_Booking_And_Allocation_Flow.md`, `master-document/1.3_Booking_Confirmation_Page.md`
Alignment:
- `SDS/core_sds.md` (Booking lifecycle + invariants)
- `SDS/data-model/schema.md` (`bookings`, `roster_slots`, `booking_companion_assignments`, partial unique index enforcing one non-terminal booking)
- Clarity artifact: `SDS/artifacts/TASK-20260429-001-clarity.json`

2. API Contract

A. `POST /bookings`
Creates a booking for a venue and start time, allocates an available duo from the roster, reserves roster slots, and returns booking id with `CONFIRMED` status.

B. `POST /bookings/{id}/cancel`
Cancels a booking in `CONFIRMED` or `ACTIVE` state, releases reserved roster slots, and returns the updated booking status.

C. `PATCH /bookings/{id}` (INTERNAL ONLY)
Edits an existing booking in `CONFIRMED` state. Supports updating any subset of `venueId` and/or `startAt`, and supports manual reassignment by specifying BOTH `captainCompanionId` and `viceCaptainCompanionId`.

On success, the edit operation MUST be atomic:
- release currently reserved roster slots for the booking
- reserve the target duo for the edited window (2 hours)
- update `booking_companion_assignments` to match the target duo

Booking artifacts stability rule:
- `qrCode`, `pinCode`, `comMatchQrCode`, `comMatchPinCode`, and `bookingColor` MUST remain unchanged across edits, even if companions change.

D. `GET /bookings/{id}/details`
Retrieves booking details for the authenticated booking owner client. Returns booking metadata with companion public info ALWAYS present (no timing-based reveal).

3. Input

A. `POST /bookings` (JSON)
- `venueId`: uuid (required)
- `startAt`: ISO-8601 timestamp (required)

Notes:
- Duration is fixed (2 hours) per 1.2.1.1.9 and Core SDS; client only selects a start time.

B. `POST /bookings/{id}/cancel` (JSON)
- No body (recommended), OR empty JSON `{}`.

C. `PATCH /bookings/{id}` (INTERNAL ONLY) (JSON)
Headers:
- `X-Internal-Token`: string (required)

Path params:
- `id`: uuid (required)

Body (any subset, but at least one field required):
- `venueId`: uuid (optional)
- `startAt`: ISO-8601 timestamp (optional)
- `captainCompanionId`: uuid (optional)
- `viceCaptainCompanionId`: uuid (optional)

Companion reassignment rule:
- Manual reassignment is supported only when BOTH `captainCompanionId` and `viceCaptainCompanionId` are provided in the same request.
- If exactly one of the companion ids is provided, return 400 `VALIDATION_ERROR`.

Duration invariant on edit:
- `endAt` is derived by server as `endAt = startAt + 2 hours` using the (possibly updated) `startAt`.

D. `GET /bookings/{id}/details`
- Path parameter: `{id}` — booking uuid
- No request body
- Callable anytime (no timing-based restrictions)

4. Output

A. `POST /bookings` (201)
```json
{
  "id": "uuid",
  "status": "CONFIRMED",
  "clientId": "uuid",
  "venueId": "uuid",
  "startAt": "ISO-8601",
  "endAt": "ISO-8601",
  "createdAt": "ISO-8601"
}
```

B. `POST /bookings/{id}/cancel` (200)
```json
{
  "id": "uuid",
  "status": "CANCELLED"
}
```

C. `PATCH /bookings/{id}` (INTERNAL ONLY) (200)
Returns updated booking summary. Same shape as `POST /bookings` response is acceptable.
```json
{
  "id": "uuid",
  "status": "CONFIRMED",
  "clientId": "uuid",
  "venueId": "uuid",
  "startAt": "ISO-8601",
  "endAt": "ISO-8601",
  "createdAt": "ISO-8601"
}
```

D. `GET /bookings/{id}/details` (200)
```json
{
  "id": "uuid",
  "status": "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED",
  "clientId": "uuid",
  "venueId": "uuid",
  "startAt": "ISO-8601",
  "endAt": "ISO-8601",
  "createdAt": "ISO-8601",
  "companions": [
    {
      "companionId": "uuid",
      "designation": "CAPTAIN" | "VICE_CAPTAIN",
      "displayName": "string",
      "languages": ["ENGLISH", "ARABIC"],
      "profilePictureUrl": "string",
      "averageRating": 0.00
    }
  ]
}
```

Response field rules:
- `companions`:
  - ALWAYS present (never `null`).
  - ALWAYS an array of exactly 2 companion objects.
  - Array MUST be ordered: `[CAPTAIN, VICE_CAPTAIN]`.
  - Exactly one element per designation.
  - Companions MUST be returned for ALL booking statuses, including `CANCELLED` and `COMPLETED`.
  - Each companion object contains ONLY public non-PII fields:
    - `companionId`: from `booking_companion_assignments.companion_id` (== `users.id`)
    - `designation`: from `booking_companion_assignments.designation`
    - `displayName`: from `users.nickname` (NO PII: no full name, email, or phone)
    - `languages`: from `companion_profiles.languages` (allowed values: `ENGLISH`, `ARABIC`)
    - `profilePictureUrl`: from `companion_profiles.profile_picture_url`
    - `averageRating`: from `companion_profiles.average_rating`

Error envelope (per Core SDS):
```json
{ "code": "string", "message": "string" }
```

5. Authorization Rules

- `POST /bookings`:
  - Requires Bearer token
  - Only `role=CLIENT`
- `POST /bookings/{id}/cancel`:
  - Requires Bearer token
  - Allowed for:
    - client who owns the booking
    - a companion assigned to the booking
    - admin (admin path/authorization handled in Admin module; not specified here)
- `PATCH /bookings/{id}` (INTERNAL ONLY):
  - Requires internalAuth ONLY using header `X-Internal-Token`.
  - Client Bearer tokens MUST NOT authorize this endpoint (this endpoint is not part of the public Bearer-authenticated surface).
  - Caller is restricted to internal services / admin tooling only.
- `GET /bookings/{id}/details`:
  - Requires Bearer token
  - Only `role=CLIENT`
  - Only the booking owner client may call: `bookings.client_id == auth.userId`
  - Explicitly NOT allowed for companions (even if assigned)

6. Preconditions

A. `POST /bookings`
- Authenticated user exists and `role == CLIENT`.
- Client has no non-terminal booking (`CONFIRMED` or `ACTIVE`).
- `venueId` references an existing venue.
- `startAt` is a valid timestamp.

B. `POST /bookings/{id}/cancel`
- Authenticated user exists.
- Booking exists.
- Caller is authorized:
  - booking owner client, OR
  - companion assigned to the booking, OR
  - admin.
- Cancellation behavior is simple:
  - If status is `CONFIRMED` or `ACTIVE`, cancellation transitions to `CANCELLED`.
  - If status is already `CANCELLED`, return idempotent success.
  - If status is `COMPLETED`, cancellation is rejected.

C. `PATCH /bookings/{id}` (INTERNAL ONLY)
- `X-Internal-Token` is present and valid, otherwise return 401 `INTERNAL_UNAUTHORIZED`.
- Booking exists, otherwise return 404 `BOOKING_NOT_FOUND`.
- Booking must be in status `CONFIRMED`.
  - If status is `ACTIVE`, `COMPLETED`, or `CANCELLED`: reject with 400 `INVALID_STATE_TRANSITION`.
- Extended/time edit safety:
  - Booking MUST NOT be extended (`bookings.extended_at` must be NULL).
  - Current server time MUST be strictly before both:
    - the booking's current `start_at`, and
    - the target edited `startAt` (if changed)
  - If violated: reject with 400 `INVALID_STATE_TRANSITION`.
- Match/presence safety constraint:
  - Internal edits are allowed only before matching/presence has progressed.
  - Both assignment rows for the booking MUST still be at defaults:
    - `presence_status='ASSIGNED'`
    - `self_match_status='NOT_MATCHED'`
    - `client_match_status='WAITING_FOR_CLIENT'`
  - If not: reject with 400 `INVALID_STATE_TRANSITION`.
- Request body must include at least one editable field (`venueId`, `startAt`, and/or BOTH companion ids). Otherwise 400 `VALIDATION_ERROR`.
- If `venueId` is provided, it must reference an existing venue, otherwise 404 `VENUE_NOT_FOUND`.
- If `startAt` is provided, it must be a valid ISO-8601 timestamp.
- If companion ids are provided:
  - MUST provide both `captainCompanionId` and `viceCaptainCompanionId`.
  - Must be distinct.
  - `captainCompanionId` must reference a COMPANION with designation `CAPTAIN`.
  - `viceCaptainCompanionId` must reference a COMPANION with designation `VICE_CAPTAIN`.
- Availability requirement (target booking window at target venue):
  - The target duo (either existing duo if not manually reassigned, or specified duo) must each have AVAILABLE `roster_slots` for the exact window `[startAt, endAt)` at the target venue.

D. `GET /bookings/{id}/details`
- Authenticated user exists.
- Authenticated user `role == CLIENT`.
- Booking exists.
- Booking is owned by authenticated client (`bookings.client_id == auth.userId`).
- Endpoint is callable regardless of booking status (including `CANCELLED` and `COMPLETED`).

7. Data Access Mapping

- `bookings`
  - `id`, `client_id`, `venue_id`, `start_at`, `end_at`, `status`, `qr_code`, `pin_code`, `booking_color`, `com_match_qr_code`, `com_match_pin_code`, `extended_at`, `created_at`
- `venues`
  - `id` (used for venue existence validation)
- `roster_slots`
  - `id`, `venue_id`, `companion_id`, `booking_id`, `start_at`, `end_at`, `status`
- `booking_companion_assignments`
  - `id`, `booking_id`, `companion_id`, `designation`, `presence_status`, `self_match_status`, `client_match_status`
- `companion_profiles`
  - `user_id`, `designation`, `languages`, `profile_picture_url`, `average_rating`
- `users`
  - `id`, `nickname`

8. Business Logic

A. `POST /bookings`
1. Authenticate and authorize `role==CLIENT`.
2. Validate input: `venueId`, `startAt`.
3. Compute booking time range:
   - `startAt = input.startAt`
   - `endAt = startAt + 2 hours` (fixed)
4. Enforce “one non-terminal booking per client”:
   - Prefer explicit pre-check for clean error, but rely on DB unique index as the source of truth.
5. Allocate duo using "First-Available" strategy (1.2.3.2) from the venue roster:
  - Identify two distinct companions with AVAILABLE roster coverage for `[startAt, endAt)` at the selected venue.
  - Captain/Vice Captain is determined by the companion’s designation assigned at signup (stored in `companion_profiles.designation`).
  - Allocation must select exactly:
    - one companion with `designation=CAPTAIN`
    - one companion with `designation=VICE_CAPTAIN`
   - Duo integrity rule (1.2.3.3): both must be available for the full duration.
6. Create booking record:
   - `status = CONFIRMED`
   - generate `bookingColor` (see Constraints: Code Generation)
   - generate companion-companion matching artifacts:
     - `comMatchQrCode`, `comMatchPinCode` (see Constraints: Code Generation)
   - generate client-companion matching artifacts (generated once at allocation; no rotation):
     - `qrCode`, `pinCode` (see Constraints: Code Generation)
7. Reserve roster slots for both companions:
   - mark selected roster slots as `BOOKED`
   - set `roster_slots.booking_id = bookings.id`
8. Create exactly two `booking_companion_assignments`:
   - Assign designations based on the companions’ stored designation:
     - CAPTAIN companion → `designation=CAPTAIN`
     - VICE_CAPTAIN companion → `designation=VICE_CAPTAIN`
   - default statuses per schema:
     - `presence_status='ASSIGNED'`
     - `self_match_status='NOT_MATCHED'`
     - `client_match_status='WAITING_FOR_CLIENT'`
9. Return booking summary.

Failure path (1.2.1.3.5):
- If no duo is available, return a deterministic error and do not create booking.

B. `POST /bookings/{id}/cancel`
1. Authenticate.
2. Fetch booking by id.
3. Authorize:
   - if caller role=CLIENT: require `bookings.client_id == caller.userId`
  - if caller role=COMPANION: require caller is assigned to the booking (`booking_companion_assignments.booking_id == booking.id AND companion_id == caller.userId`)
  - if caller is admin: allowed (admin auth rules handled elsewhere)
4. Simple cancellation logic:
  - If booking status is `CANCELLED`: return 200 `{id, status:'CANCELLED'}` (idempotent success).
  - If booking status is `COMPLETED`: return 400 `INVALID_STATE_TRANSITION`.
  - Else (status `CONFIRMED` or `ACTIVE`): proceed.
5. Update booking: set `status='CANCELLED'`.
6. Release roster reservations:
  - set `roster_slots.status='AVAILABLE'` and `booking_id=NULL` for all slots with `booking_id = bookings.id`
7. Return `{id, status:'CANCELLED'}`.

C. `PATCH /bookings/{id}` (INTERNAL ONLY)
Goal: apply requested edits and (re)allocate roster slots/assignments atomically while keeping booking artifacts stable.

1. Internal authenticate:
   - Validate `X-Internal-Token`.
   - If missing/invalid: return 401 `INTERNAL_UNAUTHORIZED`.
   - Bearer token authentication MUST NOT authorize this endpoint.

2. Validate request body:
   - Must include at least one of: `venueId`, `startAt`, or BOTH companion ids.
   - If none: 400 `VALIDATION_ERROR`.
   - If exactly one of `captainCompanionId` / `viceCaptainCompanionId` provided: 400 `VALIDATION_ERROR`.

3. Begin DB transaction.

4. Lock and load booking:
   - `SELECT ... FROM bookings WHERE id=$id FOR UPDATE`.
   - If not found: rollback and return 404 `BOOKING_NOT_FOUND`.

5. Enforce status constraint:
   - If `bookings.status != 'CONFIRMED'`: rollback and return 400 `INVALID_STATE_TRANSITION`.

5b. Enforce extended/time edit safety:
   - Booking MUST NOT be extended:
     - If `bookings.extended_at IS NOT NULL`: rollback and return 400 `INVALID_STATE_TRANSITION`.
   - Current server time MUST be strictly before `bookings.start_at`.
     - If `now >= bookings.start_at`: rollback and return 400 `INVALID_STATE_TRANSITION`.

6. Compute target time window:
   - `targetStartAt = input.startAt ?? bookings.start_at`
   - `targetEndAt = targetStartAt + 2 hours`
   - Temporal guard for edits:
     - If `now >= targetStartAt`: rollback and return 400 `INVALID_STATE_TRANSITION`

7. Compute target venue:
   - `targetVenueId = input.venueId ?? bookings.venue_id`
   - If `input.venueId` is provided, validate venue exists; if not: rollback and return 404 `VENUE_NOT_FOUND`.

8. Determine current assigned duo (for validation and defaulting):
   - Load and LOCK the two assignment rows for the booking (CAPTAIN + VICE_CAPTAIN) using `FOR UPDATE` inside the PATCH transaction.
   - Data integrity check: MUST return exactly 2 rows, containing one `designation='CAPTAIN'` and one `designation='VICE_CAPTAIN'`.
     - If violated: rollback and return 500 `INTERNAL_ERROR`.
   - Enforce edit safety constraint: both assignment rows MUST still be at default statuses:
     - `presence_status='ASSIGNED'`
     - `self_match_status='NOT_MATCHED'`
     - `client_match_status='WAITING_FOR_CLIENT'`
   - If not: rollback and return 400 `INVALID_STATE_TRANSITION`.

9. Determine target duo:
   - If BOTH `captainCompanionId` and `viceCaptainCompanionId` are provided:
     1) Validate `captainCompanionId != viceCaptainCompanionId`.
     2) Validate designations using `companion_profiles.designation`:
        - `captainCompanionId` must have designation `CAPTAIN`.
        - `viceCaptainCompanionId` must have designation `VICE_CAPTAIN`.
     3) Set `targetCaptainId = captainCompanionId`, `targetViceCaptainId = viceCaptainCompanionId`.
   - Else (no manual reassignment):
     - Keep existing duo.

10. Release currently reserved roster slots for the booking:
   - Update all `roster_slots` where `booking_id = bookings.id`:
     - set `status='AVAILABLE'`, `booking_id=NULL`
   - Data integrity check: for a CONFIRMED, non-extended booking, this SHOULD release exactly 2 slots.
     - If it releases a different count: rollback and return 500 `INTERNAL_ERROR`.
   - This MUST occur inside the same transaction as reservation of the new slots.

11. Reserve new roster slots for the target duo for the edited window (deadlock-safe):
   - Lock BOTH target roster slots in a single statement (must return exactly 2 rows) using `FOR UPDATE SKIP LOCKED`.
   - If fewer than 2 rows are returned: rollback and return 409 `NO_DUO_AVAILABLE`.
   - Book both locked slots; row-count guard MUST be exactly 2.

12. Update booking time/venue fields (artifacts unchanged).

13. Update `booking_companion_assignments` to match target duo.
   - If a companion id changed for a designation, reset that row’s match-related statuses to defaults.

14. Commit transaction.

15. Return updated booking summary (status remains `CONFIRMED`).

D. `GET /bookings/{id}/details`
1. Authenticate and authorize `role==CLIENT`.
2. Fetch booking by id.
3. Authorize owner: require `bookings.client_id == caller.userId`.
4. Load exactly two assignment rows for the booking (CAPTAIN + VICE_CAPTAIN).
   - Data integrity check: MUST return exactly 2 rows, containing one `CAPTAIN` and one `VICE_CAPTAIN`.
   - If violated: return 500 `INTERNAL_ERROR`.
5. Join to companion public info sources (NO PII):
   - `users.nickname` for `displayName`
   - `companion_profiles.languages`, `profile_picture_url`, `average_rating`
6. Return companions array with exactly 2 elements, ordered: [CAPTAIN, VICE_CAPTAIN].

Notes:
- No timing-based reveal; companions are ALWAYS returned.
- Companions are returned for all booking statuses, including `CANCELLED` and `COMPLETED`.

9. State Changes

- Booking status:
  - On create: `CONFIRMED`
  - On cancel (pre-session): `CONFIRMED → CANCELLED`
  - On cancel (in-session): `ACTIVE → CANCELLED`
  - On internal edit (PATCH /bookings/{id}): booking status remains `CONFIRMED` (no lifecycle transition).
  - On GET /bookings/{id}/details: no state change.

- RosterSlot status:
  - On create: `AVAILABLE → BOOKED` (for the two selected slots)
  - On cancel: `BOOKED → AVAILABLE` (for slots linked to the cancelled booking)
  - On internal edit (PATCH /bookings/{id}`): release+reserve atomic within a transaction.

- BookingCompanionAssignment:
  - Created during booking creation.
  - On internal edit: `companion_id` may change; if changed reset match statuses to defaults.

10. DB Operations

A. `POST /bookings`
- Pre-check (optional): `SELECT id FROM bookings WHERE client_id = $1 AND status IN ('CONFIRMED','ACTIVE') LIMIT 1`
- Allocate two roster slots (CAPTAIN + VICE_CAPTAIN) using `FOR UPDATE SKIP LOCKED`.
- Insert booking.
- Reserve roster slots.
- Insert two assignments.

B. `POST /bookings/{id}/cancel`
- Lock booking.
- If caller role=COMPANION, authorization check via `booking_companion_assignments`.
- Update booking status.
- Release roster slots.

C. `PATCH /bookings/{id}` (INTERNAL ONLY)
- Lock booking + lock assignment rows.
- Release existing reservations.
- Lock and reserve the two target slots (deadlock-safe).
- Update booking fields (artifacts unchanged).
- Update assignment rows to match target duo.

D. `GET /bookings/{id}/details`
- Fetch booking core fields:
  - `SELECT id, status, client_id, venue_id, start_at, end_at, created_at FROM bookings WHERE id = $1 LIMIT 1`
- Fetch companion public info (no PII) (MUST return exactly 2 rows):
  - `SELECT bca.companion_id, bca.designation, u.nickname, cp.languages, cp.profile_picture_url, cp.average_rating
     FROM booking_companion_assignments bca
     JOIN users u ON u.id = bca.companion_id
     JOIN companion_profiles cp ON cp.user_id = bca.companion_id
     WHERE bca.booking_id = $1
     ORDER BY CASE bca.designation WHEN 'CAPTAIN' THEN 1 WHEN 'VICE_CAPTAIN' THEN 2 ELSE 3 END`

11. Transaction Boundaries

A. `POST /bookings`: MUST be a single DB transaction (allocate → create booking → reserve → assignments).

B. `POST /bookings/{id}/cancel`: MUST be a single DB transaction (status update + release).

C. `PATCH /bookings/{id}` (INTERNAL ONLY): MUST be a single DB transaction.

D. `GET /bookings/{id}/details`: read-only; no transaction required.

12. Constraints

- Fixed duration:
  - `endAt = startAt + 2 hours` at creation.
  - On internal edit, `endAt` MUST be recalculated from `startAt`.

- One non-terminal booking per client: enforced by partial unique index.

- Exactly two companion assignments per booking: one CAPTAIN and one VICE_CAPTAIN.

- Booking artifacts stability on internal edit: codes/colors MUST remain unchanged.

13. Concurrency Rules

- GET /bookings/{id}/details:
  - No row locks required; read-only operation.
  - No timing-based behavior.

- Prevent double-booking: lock roster slots + conditional updates.

- Concurrent booking attempts by same client: unique index rejects second insert.

- Internal edit concurrency:
  - Lock booking row and assignment rows.
  - Release+reserve within same transaction.
  - Retry policy for DB deadlock/serialization failures (up to 2 retries) as per prior versions.

14. Failure Cases

- `POST /bookings`
  - 400 `VALIDATION_ERROR`
  - 404 `VENUE_NOT_FOUND`
  - 409 `CLIENT_ALREADY_HAS_NON_TERMINAL_BOOKING`
  - 409 `NO_DUO_AVAILABLE`
  - 500 `INTERNAL_ERROR`

- `POST /bookings/{id}/cancel`
  - 401 `UNAUTHORIZED`
  - 403 `FORBIDDEN`
  - 403 `COMPANION_NOT_ASSIGNED`
  - 404 `BOOKING_NOT_FOUND`
  - 400 `INVALID_STATE_TRANSITION`
  - 500 `INTERNAL_ERROR`

- `PATCH /bookings/{id}` (INTERNAL ONLY)
  - 401 `INTERNAL_UNAUTHORIZED`
  - 400 `VALIDATION_ERROR`
  - 404 `BOOKING_NOT_FOUND`
  - 404 `VENUE_NOT_FOUND`
  - 400 `INVALID_STATE_TRANSITION`
  - 409 `NO_DUO_AVAILABLE`
  - 500 `INTERNAL_ERROR`

- `GET /bookings/{id}/details`
  - 401 `UNAUTHORIZED`
  - 403 `FORBIDDEN`
  - 404 `BOOKING_NOT_FOUND`
  - 500 `INTERNAL_ERROR`

15. Side Effects

- On successful booking creation:
  - Send push notification to client: "Booking Confirmed".
  - Do NOT notify companions on booking creation.

- On cancellation:
  - Send push notifications to companions and client: "Booking Cancelled".

- On internal edit (PATCH /bookings/{id}`):
  - No notifications are specified in this version.

16. Idempotency Rules

- `POST /bookings` is not idempotent.

- `POST /bookings/{id}/cancel`:
  - If booking is already `CANCELLED`, return 200 with `{id, status:'CANCELLED'}` (idempotent success).
  - If booking is `COMPLETED`, return 400 `INVALID_STATE_TRANSITION`.

- `GET /bookings/{id}/details`: idempotent.

- `PATCH /bookings/{id}` (INTERNAL ONLY): designed to be safely retryable within concurrency retry rules.
