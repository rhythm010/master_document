Feature: Booking & Allocation
Version: 1.2.0
Status: Current
Previous Version: booking-and-allocation.feature-sds.v1.1.1.md
Change Type: MINOR
Change Summary: Add GET /bookings/{id}/details client-only endpoint with timed companion reveal (T-5h) per master-document/1.3
Created At: 2026-04-28T16:00:00Z
Last Edited At: 2026-04-29T04:15:09Z
Owner: Booking & Allocation Module

Feature: Booking & Allocation
Module: Booking & Allocation

1. Purpose

Implement booking creation and allocation of a companion duo (Captain + Vice Captain) from a venue-based roster, enforce the "one non-terminal booking per client" rule, support cancellation (pre-session and in-session) with roster release, and provide client-only booking details retrieval with timed companion reveal.

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
- Clarity artifact: `SDS/artifacts/TASK-20260428-002-clarity.json`

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
Retrieves booking details for the authenticated client. Returns booking metadata with conditionally revealed companion information based on timing rules (T-5h before startAt).

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
      "designation": "CAPTAIN" | "VICE_CAPTAIN",
      "displayName": "string",
      "languages": ["string"],
      "profilePictureUrl": "string",
      "averageRating": 0.00
    }
  ] | null
}
```

Response field rules:
- `companions`:
  - `null` when current time < (startAt - 5 hours) OR booking status is `CANCELLED` OR booking status is `COMPLETED`
  - Array of exactly 2 companion objects when current time >= (startAt - 5 hours) AND booking status is `CONFIRMED` or `ACTIVE`
  - Array is ordered: [CAPTAIN, VICE_CAPTAIN]
  - Each companion object contains:
    - `designation`: from `booking_companion_assignments.designation`
    - `displayName`: from `users.nickname` (NO PII: no full name, email, or phone)
    - `languages`: from `companion_profiles.languages`
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
     - Keep existing duo:
       - `targetCaptainId = currentCaptainId`
       - `targetViceCaptainId = currentViceCaptainId`

10. Release currently reserved roster slots for the booking:
   - Update all `roster_slots` where `booking_id = bookings.id`:
     - set `status='AVAILABLE'`, `booking_id=NULL`
   - Data integrity check: for a CONFIRMED, non-extended booking, this SHOULD release exactly 2 slots.
     - If it releases a different count: rollback and return 500 `INTERNAL_ERROR`.
   - This MUST occur inside the same transaction as reservation of the new slots.

11. Reserve new roster slots for the target duo for the edited window (deadlock-safe):
   - Lock BOTH target roster slots in a single statement (must return exactly 2 rows):
     - Find rows matching:
       - `venue_id=targetVenueId`, `start_at=targetStartAt`, `end_at=targetEndAt`, `status='AVAILABLE'`
       - `companion_id IN (targetCaptainId, targetViceCaptainId)`
     - Lock using `FOR UPDATE SKIP LOCKED`.
   - If fewer than 2 rows are returned (missing/unavailable/locked): rollback and return 409 `NO_DUO_AVAILABLE`.
   - Book both locked slots:
     - set `status='BOOKED'`, `booking_id=bookings.id`
   - Row-count guard:
     - The BOOK update MUST affect exactly 2 rows; otherwise rollback and return 409 `NO_DUO_AVAILABLE`.

12. Update booking time/venue fields (artifacts unchanged):
   - Update `bookings.venue_id = targetVenueId` (if changed)
   - Update `bookings.start_at = targetStartAt` and `bookings.end_at = targetEndAt` (if changed)
   - MUST NOT change: `qr_code`, `pin_code`, `com_match_qr_code`, `com_match_pin_code`, `booking_color`.

13. Update `booking_companion_assignments` to match target duo:
   - Ensure exactly one CAPTAIN assignment and one VICE_CAPTAIN assignment remain for the booking.
   - Update the CAPTAIN assignment row `companion_id = targetCaptainId`.
   - Update the VICE_CAPTAIN assignment row `companion_id = targetViceCaptainId`.
   - If a companion id changed for a designation, reset that row’s match-related statuses to defaults:
     - `presence_status='ASSIGNED'`
     - `self_match_status='NOT_MATCHED'`
     - `client_match_status='WAITING_FOR_CLIENT'`

14. Commit transaction.

15. Return updated booking summary (status remains `CONFIRMED`).


D. `GET /bookings/{id}/details`
1. Authenticate and authorize `role==CLIENT`.
2. Fetch booking by id.
3. Authorize owner:
   - require `bookings.client_id == caller.userId`.
4. Compute reveal time:
   - `revealTime = bookings.start_at - 5 hours`.
5. Determine whether to reveal companions:
   - If `current_time < revealTime`: companions = null
   - If `bookings.status == 'CANCELLED'`: companions = null
   - If `bookings.status == 'COMPLETED'`: companions = null
   - Else (status is `CONFIRMED` or `ACTIVE` AND current_time >= revealTime): reveal companions
6. If companions should be revealed:
   - Load exactly two assignment rows for the booking (CAPTAIN + VICE_CAPTAIN)
   - Join to `users.nickname` and `companion_profiles` for the assigned companions
   - Return companions array with exactly 2 elements, ordered: [CAPTAIN, VICE_CAPTAIN]
7. If companions should NOT be revealed:
   - Set companions field to `null`

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
  - On internal edit (PATCH /bookings/{id}):
    - release currently reserved slots: `BOOKED → AVAILABLE` (for slots linked to the booking)
    - reserve new slots for target duo/window: `AVAILABLE → BOOKED`
    - both operations must be atomic within a transaction

- BookingCompanionAssignment:
  - Created during booking creation.
  - On internal edit (PATCH /bookings/{id}):
    - `companion_id` may change for CAPTAIN and/or VICE_CAPTAIN designations.
    - If changed, reset the affected assignment’s `presence_status/self_match_status/client_match_status` back to defaults.

10. DB Operations

A. `POST /bookings`
- Pre-check (optional but recommended for clear error):
  - `SELECT id FROM bookings WHERE client_id = $1 AND status IN ('CONFIRMED','ACTIVE') LIMIT 1`

- Allocate two roster slots (must return two rows for two different companions):
  - Example (exact SQL may vary):
    - Select 1 Captain slot:
      - `SELECT rs.id, rs.companion_id
         FROM roster_slots rs
         JOIN companion_profiles cp ON cp.user_id = rs.companion_id
         WHERE rs.venue_id = $1
           AND rs.start_at = $2
           AND rs.end_at = $3
           AND rs.status = 'AVAILABLE'
           AND cp.designation = 'CAPTAIN'
         ORDER BY rs.id ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`

    - Select 1 Vice Captain slot:
      - `SELECT rs.id, rs.companion_id
         FROM roster_slots rs
         JOIN companion_profiles cp ON cp.user_id = rs.companion_id
         WHERE rs.venue_id = $1
           AND rs.start_at = $2
           AND rs.end_at = $3
           AND rs.status = 'AVAILABLE'
           AND cp.designation = 'VICE_CAPTAIN'
         ORDER BY rs.id ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`

- Insert booking:
  - `INSERT INTO bookings (id, client_id, venue_id, start_at, end_at, status, qr_code, pin_code, booking_color, com_match_qr_code, com_match_pin_code, extended_at)
     VALUES ($id, $clientId, $venueId, $startAt, $endAt, 'CONFIRMED', $qrCode, $pinCode, $bookingColor, $comQr, $comPin, NULL)`

- Reserve roster slots:
  - `UPDATE roster_slots
     SET status = 'BOOKED', booking_id = $bookingId
     WHERE id IN ($slot1, $slot2) AND status = 'AVAILABLE'`

- Insert assignments (2 rows):
  - `INSERT INTO booking_companion_assignments (id, booking_id, companion_id, designation)
     VALUES ($a1, $bookingId, $companion1, 'CAPTAIN'), ($a2, $bookingId, $companion2, 'VICE_CAPTAIN')`

Notes:
- The DB enforces:
  - one non-terminal booking per client via `uq_bookings_one_non_terminal_per_client`
  - no two assignments with same designation per booking and no duplicate companion assignment per booking via unique constraints

B. `POST /bookings/{id}/cancel`
- Lock booking for update:
  - `SELECT id, status, client_id FROM bookings WHERE id = $1 FOR UPDATE`
- If caller role=COMPANION, authorization check:
  - `SELECT 1 FROM booking_companion_assignments WHERE booking_id = $1 AND companion_id = $2 LIMIT 1`
- Update booking status:
  - `UPDATE bookings SET status = 'CANCELLED' WHERE id = $1`
- Release roster slots:
  - `UPDATE roster_slots SET status = 'AVAILABLE', booking_id = NULL WHERE booking_id = $1`

C. `PATCH /bookings/{id}` (INTERNAL ONLY)
- Lock booking:
  - `SELECT id, status, client_id, venue_id, start_at, end_at, extended_at, created_at
     FROM bookings
     WHERE id = $1
     FOR UPDATE`

- Validate booking is CONFIRMED in application logic (else 400 INVALID_STATE_TRANSITION).

- Load and lock current duo (prevents races with match/presence updates):
  - `SELECT designation, companion_id, presence_status, self_match_status, client_match_status
     FROM booking_companion_assignments
     WHERE booking_id = $1
     FOR UPDATE`

- If venueId provided, validate venue:
  - `SELECT id FROM venues WHERE id = $1 LIMIT 1`

- If manual reassignment requested, validate designations:
  - Captain:
    - `SELECT 1 FROM companion_profiles WHERE user_id = $1 AND designation = 'CAPTAIN' LIMIT 1`
  - Vice Captain:
    - `SELECT 1 FROM companion_profiles WHERE user_id = $1 AND designation = 'VICE_CAPTAIN' LIMIT 1`

- Release existing reservations for the booking:
  - `UPDATE roster_slots
     SET status = 'AVAILABLE', booking_id = NULL
     WHERE booking_id = $1`
  - Guard: this SHOULD release exactly 2 rows for a CONFIRMED, non-extended booking; otherwise treat as data-integrity failure.

- Reserve target duo slots for target window (deadlock-safe):
  - Lock BOTH slots in one query:
    - `SELECT id, companion_id FROM roster_slots
       WHERE venue_id = $1
         AND start_at = $2
         AND end_at = $3
         AND status = 'AVAILABLE'
         AND companion_id IN ($targetCaptainId, $targetViceCaptainId)
       FOR UPDATE SKIP LOCKED`
  - Guard: MUST return exactly 2 rows; else rollback and return 409 NO_DUO_AVAILABLE.

  - Book both slots:
    - `UPDATE roster_slots
       SET status = 'BOOKED', booking_id = $bookingId
       WHERE id IN ($slotId1, $slotId2) AND status = 'AVAILABLE'`
  - Guard: MUST update exactly 2 rows; else rollback and return 409 NO_DUO_AVAILABLE.

- Update booking fields (do NOT update code artifacts):
  - `UPDATE bookings
     SET venue_id = $targetVenueId,
         start_at = $targetStartAt,
         end_at = $targetEndAt
     WHERE id = $bookingId`

- Update assignments to match target duo:
  - `UPDATE booking_companion_assignments
     SET companion_id = $targetCaptainId,
         presence_status = CASE WHEN companion_id <> $targetCaptainId THEN 'ASSIGNED' ELSE presence_status END,
         self_match_status = CASE WHEN companion_id <> $targetCaptainId THEN 'NOT_MATCHED' ELSE self_match_status END,
         client_match_status = CASE WHEN companion_id <> $targetCaptainId THEN 'WAITING_FOR_CLIENT' ELSE client_match_status END
     WHERE booking_id = $bookingId AND designation = 'CAPTAIN'`

  - `UPDATE booking_companion_assignments
     SET companion_id = $targetViceCaptainId,
         presence_status = CASE WHEN companion_id <> $targetViceCaptainId THEN 'ASSIGNED' ELSE presence_status END,
         self_match_status = CASE WHEN companion_id <> $targetViceCaptainId THEN 'NOT_MATCHED' ELSE self_match_status END,
         client_match_status = CASE WHEN companion_id <> $targetViceCaptainId THEN 'WAITING_FOR_CLIENT' ELSE client_match_status END
     WHERE booking_id = $bookingId AND designation = 'VICE_CAPTAIN'`


D. `GET /bookings/{id}/details`
- Fetch booking core fields:
  - `SELECT id, status, client_id, venue_id, start_at, end_at, created_at FROM bookings WHERE id = $1 LIMIT 1`

- If companions are revealed, fetch companion public info (no PII):
  - `SELECT bca.designation, u.nickname, cp.languages, cp.profile_picture_url, cp.average_rating
     FROM booking_companion_assignments bca
     JOIN users u ON u.id = bca.companion_id
     JOIN companion_profiles cp ON cp.user_id = bca.companion_id
     WHERE bca.booking_id = $1
     ORDER BY CASE bca.designation WHEN 'CAPTAIN' THEN 1 WHEN 'VICE_CAPTAIN' THEN 2 ELSE 3 END`

11. Transaction Boundaries

A. `POST /bookings`
- Must be a single DB transaction to guarantee atomicity:
  - enforce one-booking rule
  - allocate roster slots
  - create booking
  - reserve slots
  - create assignments

B. `POST /bookings/{id}/cancel`
- Must be a single DB transaction to guarantee atomicity:
  - update booking status
  - release roster slots

C. `PATCH /bookings/{id}` (INTERNAL ONLY)
- MUST be a single DB transaction to guarantee atomicity across:
  - booking status validation (CONFIRMED only)
  - optional venue validation
  - release of existing roster slots for the booking
  - reservation of the target duo’s roster slots for the target window
  - update of booking time/venue fields
  - update of booking_companion_assignments to match the target duo

12. Constraints

- Fixed duration:
  - `endAt = startAt + 2 hours` at creation.
  - On internal edit, `endAt` MUST be recalculated from the (possibly updated) `startAt` as `startAt + 2 hours`.

- One non-terminal booking per client:
  - Enforced by DB partial unique index on `bookings(client_id)` where status in (`CONFIRMED`,`ACTIVE`).

- Exactly two companion assignments per booking:
  - Must be created at booking creation time: one CAPTAIN and one VICE_CAPTAIN.
  - On internal edit, assignments MUST remain exactly one CAPTAIN and one VICE_CAPTAIN.

- Venue-based roster:
  - Allocation/reservation is based on `roster_slots` filtered by `venue_id`.

- Booking artifacts stability on internal edit:
  - `qrCode`, `pinCode`, `comMatchQrCode`, `comMatchPinCode`, and `bookingColor` MUST remain unchanged across `PATCH /bookings/{id}` even if companions change.

- Code Generation (Booking + Matching Artifacts):
  - `qrCode`:
    - Opaque random string (UUIDv4 acceptable), generated via cryptographically secure RNG.
    - Stored in `bookings.qr_code`.
  - `pinCode`:
    - 6-character string, digits only, leading zeros allowed.
    - Generated via cryptographically secure RNG.
    - Stored in `bookings.pin_code`.
  - `bookingColor`:
    - Selected from a fixed palette of identifiers:
      - `["RED","BLUE","GREEN","YELLOW","PURPLE","ORANGE","PINK","TEAL","INDIGO","LIME","AMBER","CYAN"]`
    - Must be stable per booking.
    - Best-effort uniqueness rule: pick the first color from the palette not currently used by another non-terminal booking (status in CONFIRMED/ACTIVE) at the same venue; if all are taken, pick `RED`.
    - Stored in `bookings.booking_color`.
  - `comMatchQrCode`:
    - Opaque random string (UUIDv4 acceptable), generated via cryptographically secure RNG.
    - Stored in `bookings.com_match_qr_code`.
  - `comMatchPinCode`:
    - 6-character string, digits only, leading zeros allowed.
    - Generated via cryptographically secure RNG.
    - Stored in `bookings.com_match_pin_code`.

- Roster Slot Provisioning:
  - On companion signup, roster slots for the coming week (next 7 days) are created for that companion per venue roster rules.
  - New roster slots are created with `status='AVAILABLE'`, `booking_id=NULL`.
  - Booking creation reserves existing matching slots by setting `status='BOOKED'` and `booking_id=booking.id`.

13. Concurrency Rules

- GET /bookings/{id}/details:
  - No row locks required; read-only operation.
  - Timing-based reveal uses server current time; concurrent reads may see different reveal states during the 5-hour threshold window (acceptable behavior).

- Prevent double-booking of the same roster slot:
  - Allocation/reservation must lock candidate `roster_slots` rows and only update rows still `status='AVAILABLE'`.
  - If reservation update affects fewer than 2 rows, treat as allocation failure and rollback.

- Concurrent booking attempts by same client:
  - DB partial unique index will reject the second insert; map this to 409 `CLIENT_ALREADY_HAS_NON_TERMINAL_BOOKING`.

- Internal edit concurrency (PATCH /bookings/{id}):
  - The booking row MUST be locked (`FOR UPDATE`) to prevent concurrent edits/cancels from creating partial state.
  - The two assignment rows MUST be locked (`FOR UPDATE`) before checking default statuses.
  - Release+reserve MUST occur within the same transaction.
  - Deadlock avoidance:
    - Slot locking MUST be deterministic by locking both target `roster_slots` rows in a single statement (preferred) using `FOR UPDATE SKIP LOCKED`.
  - Retry policy:
    - Retry the full PATCH transaction up to 2 times only for DB concurrency failures:
      - SQLSTATE `40P01` (deadlock_detected)
      - SQLSTATE `40001` (serialization_failure)
    - Use a small jittered backoff between retries.
    - If retries are exhausted: return 500 `INTERNAL_ERROR` (do not map to NO_DUO_AVAILABLE).

14. Failure Cases

- `POST /bookings`
  - 400 `VALIDATION_ERROR` — missing/invalid `venueId` or `startAt`
  - 404 `VENUE_NOT_FOUND`
  - 409 `CLIENT_ALREADY_HAS_NON_TERMINAL_BOOKING`
  - 409 `NO_DUO_AVAILABLE` — fewer than 2 available roster slots for `[startAt,endAt)`
  - 500 `INTERNAL_ERROR`

- `POST /bookings/{id}/cancel`
  - 401 `UNAUTHORIZED`
  - 403 `FORBIDDEN`
  - 403 `COMPANION_NOT_ASSIGNED` — caller is a companion but is not assigned to the booking
  - 404 `BOOKING_NOT_FOUND`
  - 400 `INVALID_STATE_TRANSITION` — e.g., cancel `COMPLETED`
  - 500 `INTERNAL_ERROR`

- `PATCH /bookings/{id}` (INTERNAL ONLY)
  - 401 `INTERNAL_UNAUTHORIZED` — missing/invalid `X-Internal-Token`
  - 400 `VALIDATION_ERROR` — invalid/missing body, invalid ids/timestamps, or only one companion id provided
  - 404 `BOOKING_NOT_FOUND`
  - 404 `VENUE_NOT_FOUND` — when `venueId` is provided and invalid
  - 400 `INVALID_STATE_TRANSITION` — booking status is `ACTIVE`/`COMPLETED`/`CANCELLED`, OR assignment match/presence statuses have progressed beyond defaults
  - 409 `NO_DUO_AVAILABLE` — specified/target duo cannot be reserved for the target venue/window (slots unavailable)
  - 500 `INTERNAL_ERROR` — data-integrity failures and deadlock/serialization retry exhaustion

15. Side Effects

- On successful booking creation:
  - Send push notification to client: "Booking Confirmed".
  - Do NOT notify companions on booking creation.

- On cancellation:
  - Send push notifications to companions and client: "Booking Cancelled".

- On internal edit (PATCH /bookings/{id}):
  - No notifications are specified in this version.

**Notification Architecture (Simple):**
- Provider: Expo Notifications (expo-notifications per tech-stack.md)
- Device token registration: Client app registers Expo Push Token on login (stored in user session or separate device_tokens table)
- Message format: JSON payload with `{ "event": "BOOKING_CONFIRMED"|"BOOKING_CANCELLED", "message": "string", "bookingId": "uuid" }`
- Delivery: Best-effort; no retry logic in Phase 1
- User preferences: No opt-out in Phase 1; all notifications are sent
- Implementation: Backend service calls Expo Push Notification API (https://docs.expo.dev/push-notifications/sending-notifications/) with Expo Push Tokens after booking creation/cancellation

16. Idempotency Rules

- `POST /bookings` is not idempotent.

- `POST /bookings/{id}/cancel`:
  - If booking is already `CANCELLED`, return 200 with `{id, status:'CANCELLED'}` (idempotent success).
  - If booking is `COMPLETED`, return 400 `INVALID_STATE_TRANSITION`.

- `PATCH /bookings/{id}` (INTERNAL ONLY):
  - Not guaranteed idempotent in the strict sense (it performs allocation-style operations), but is designed to be safely retryable:
    - it executes in a transaction
    - it releases the booking’s current reservations and reserves the target duo/window atomically
    - repeated calls with the same target venue/time/duo should converge on the same stored booking/assignment state
