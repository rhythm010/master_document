Feature: Booking & Allocation
Version: 1.2.0
Status: Current
Previous Version: booking-and-allocation.feature-sds.v1.1.0.md
Change Type: MINOR
Change Summary: Add GET /bookings/{id}/details client-only endpoint with timed companion reveal (T-5h) per master-document/1.3
Created At: 2026-04-28T16:00:00Z
Last Edited At: 2026-04-29T04:15:09Z
Owner: Booking & Allocation Module

Module: Booking & Allocation

1. Purpose

Implement booking creation and allocation of a companion duo (Captain + Vice Captain) from a venue-based roster, enforce the "one non-terminal booking per client" rule, support cancellation (pre-session and in-session) with roster release, and provide client-only booking details retrieval with timed companion reveal.

Dependencies / Assumptions:
- Venue selection and availability/time-slot selection are handled upstream (separate CDC). This module expects `venueId` and `startAt` to be provided from those pages and treats missing/invalid values as a request validation error.
- In this version, server-side validation for "startAt is in the future" and "within venue operating hours" is not enforced here; upstream availability only returns valid future slots.
- Venues & Availability module owns roster slot population/backfill. Roster slots for the coming week are created for each companion at signup and backfilled if missing (see Constraints).
- Admin reassignment (1.2.4.2) is deferred and not implemented in this version.

Source: `master-document/1.2_Booking_And_Allocation_Flow.md`, `master-document/1.3`
Alignment:
- `SDS/core_sds.md` (Booking lifecycle + invariants)
- `SDS/data-model/schema.md` (`bookings`, `roster_slots`, `booking_companion_assignments`, partial unique index enforcing one non-terminal booking)

2. API Contract

A. `POST /bookings`
Creates a booking for a venue and start time, allocates an available duo from the roster, reserves roster slots, and returns booking id with `CONFIRMED` status.

B. `GET /bookings/{id}/details`
Retrieves booking details for the authenticated client. Returns booking metadata with conditionally revealed companion information based on timing rules (T-5h before startAt).

C. `POST /bookings/{id}/cancel`
Cancels a booking in `CONFIRMED` or `ACTIVE` state, releases reserved roster slots, and returns the updated booking status.

3. Input

A. `POST /bookings` (JSON)
- `venueId`: uuid (required)
- `startAt`: ISO-8601 timestamp (required)

Notes:
- Duration is fixed (2 hours) per 1.2.1.1.9 and Core SDS; client only selects a start time.

B. `GET /bookings/{id}/details`
- Path parameter: `{id}` — booking uuid
- No request body

C. `POST /bookings/{id}/cancel` (JSON)
- No body (recommended), OR empty JSON `{}`.

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

B. `GET /bookings/{id}/details` (200)
```json
{
  "id": "uuid",
  "status": "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED",
  "clientId": "uuid",
  "venueId": "uuid",
  "startAt": "ISO-8601",
  "endAt": "ISO-8601",
  "qrCode": "string",
  "pinCode": "string",
  "bookingColor": "string",
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

C. `POST /bookings/{id}/cancel` (200)
```json
{
  "id": "uuid",
  "status": "CANCELLED"
}
```

Error envelope (per Core SDS):
```json
{ "code": "string", "message": "string" }
```

5. Authorization Rules

- `POST /bookings`:
  - Requires Bearer token
  - Only `role=CLIENT`
- `GET /bookings/{id}/details`:
  - Requires Bearer token
  - Only `role=CLIENT`
  - Owner-only: `bookings.client_id == caller.userId`
- `POST /bookings/{id}/cancel`:
  - Requires Bearer token
  - Allowed for:
    - client who owns the booking
    - a companion assigned to the booking
    - admin (admin path/authorization handled in Admin module; not specified here)

6. Preconditions

A. `POST /bookings`
- Authenticated user exists and `role == CLIENT`.
- Client has no non-terminal booking (`CONFIRMED` or `ACTIVE`).
- `venueId` references an existing venue.
- `startAt` is a valid timestamp.

B. `GET /bookings/{id}/details`
- Authenticated user exists and `role == CLIENT`.
- Booking exists.
- Caller is the booking owner: `bookings.client_id == caller.userId`.

C. `POST /bookings/{id}/cancel`
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

7. Data Access Mapping

- `bookings`
  - `id`, `client_id`, `venue_id`, `start_at`, `end_at`, `status`, `qr_code`, `pin_code`, `booking_color`, `com_match_qr_code`, `com_match_pin_code`, `extended_at`, `created_at`
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
4. Enforce "one non-terminal booking per client":
   - Prefer explicit pre-check for clean error, but rely on DB unique index as the source of truth.
5. Allocate duo using "First-Available" strategy (1.2.3.2) from the venue roster:
  - Identify two distinct companions with AVAILABLE roster coverage for `[startAt, endAt)` at the selected venue.
  - Captain/Vice Captain is determined by the companion's designation assigned at signup (stored in `companion_profiles.designation`).
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
   - Assign designations based on the companions' stored designation:
     - CAPTAIN companion → `designation=CAPTAIN`
     - VICE_CAPTAIN companion → `designation=VICE_CAPTAIN`
   - default statuses per schema:
     - `presence_status='ASSIGNED'`
     - `self_match_status='NOT_MATCHED'`
     - `client_match_status='WAITING_FOR_CLIENT'`
9. Return booking summary.

Failure path (1.2.1.3.5):
- If no duo is available, return a deterministic error and do not create booking.

B. `GET /bookings/{id}/details`
1. Authenticate and authorize `role==CLIENT`.
2. Fetch booking by id from `bookings` table.
3. Authorize owner-only: require `bookings.client_id == caller.userId`.
   - If not owner: return 403 `FORBIDDEN`.
4. Determine companion reveal eligibility:
   - Calculate reveal threshold: `revealTime = bookings.start_at - 5 hours`
   - Evaluate reveal conditions:
     - If `current_time < revealTime`: companions = null
     - If `bookings.status == 'CANCELLED'`: companions = null
     - If `bookings.status == 'COMPLETED'`: companions = null
     - Else (status is `CONFIRMED` or `ACTIVE` AND current_time >= revealTime): reveal companions
5. If companions should be revealed:
   - Fetch both companion assignments from `booking_companion_assignments` for this booking
   - For each assignment, join to `companion_profiles` and `users` to retrieve:
     - `designation` (from assignment)
     - `displayName` (from users.nickname)
     - `languages` (from companion_profiles.languages)
     - `profilePictureUrl` (from companion_profiles.profile_picture_url)
     - `averageRating` (from companion_profiles.average_rating)
   - Order results: CAPTAIN first, VICE_CAPTAIN second
   - Return companions array with exactly 2 elements
6. If companions should NOT be revealed:
   - Set companions field to `null`
7. Return booking details response with all fields.

C. `POST /bookings/{id}/cancel`
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

9. State Changes

- Booking status:
  - On create: `CONFIRMED`
  - On cancel (pre-session): `CONFIRMED → CANCELLED`
  - On cancel (in-session): `ACTIVE → CANCELLED`
  - No state change on GET /bookings/{id}/details

- RosterSlot status:
  - On create: `AVAILABLE → BOOKED` (for the two selected slots)
  - On cancel: `BOOKED → AVAILABLE` (for slots linked to the cancelled booking)
  - No state change on GET /bookings/{id}/details

- BookingCompanionAssignment:
  - Created during booking creation; no state changes in this module.

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

B. `GET /bookings/{id}/details`
- Fetch booking:
  - `SELECT id, client_id, venue_id, start_at, end_at, status, qr_code, pin_code, booking_color, created_at
     FROM bookings
     WHERE id = $1`

- If companion reveal required (currentTime >= startAt - 5 hours AND status IN ('CONFIRMED', 'ACTIVE')):
  - `SELECT
       bca.designation,
       u.nickname AS display_name,
       cp.languages,
       cp.profile_picture_url,
       cp.average_rating
     FROM booking_companion_assignments bca
     JOIN companion_profiles cp ON cp.user_id = bca.companion_id
     JOIN users u ON u.id = bca.companion_id
     WHERE bca.booking_id = $1
     ORDER BY
       CASE bca.designation
         WHEN 'CAPTAIN' THEN 1
         WHEN 'VICE_CAPTAIN' THEN 2
       END`

C. `POST /bookings/{id}/cancel`
- Lock booking for update:
  - `SELECT id, status, client_id FROM bookings WHERE id = $1 FOR UPDATE`
- If caller role=COMPANION, authorization check:
  - `SELECT 1 FROM booking_companion_assignments WHERE booking_id = $1 AND companion_id = $2 LIMIT 1`
- Update booking status:
  - `UPDATE bookings SET status = 'CANCELLED' WHERE id = $1`
- Release roster slots:
  - `UPDATE roster_slots SET status = 'AVAILABLE', booking_id = NULL WHERE booking_id = $1`

11. Transaction Boundaries

A. `POST /bookings`
- Must be a single DB transaction to guarantee atomicity:
  - enforce one-booking rule
  - allocate roster slots
  - create booking
  - reserve slots
  - create assignments

B. `GET /bookings/{id}/details`
- Read-only operation; no transaction required (uses default read isolation).

C. `POST /bookings/{id}/cancel`
- Must be a single DB transaction to guarantee atomicity:
  - update booking status
  - release roster slots

12. Constraints

- Fixed duration:
  - `endAt = startAt + 2 hours` at creation.
- One non-terminal booking per client:
  - Enforced by DB partial unique index on `bookings(client_id)` where status in (`CONFIRMED`,`ACTIVE`).
- Exactly two companion assignments per booking:
  - Must be created at booking creation time: one CAPTAIN and one VICE_CAPTAIN.
- Venue-based roster:
  - Allocation is based on `roster_slots` filtered by `venue_id`.

- Companion Reveal Rule (GET /bookings/{id}/details):
  - Companions are revealed only when ALL of the following are true:
    - Current server time >= (booking.startAt - 5 hours)
    - Booking status is `CONFIRMED` or `ACTIVE`
  - Companions are NOT revealed (companions=null) when ANY of the following are true:
    - Current server time < (booking.startAt - 5 hours)
    - Booking status is `CANCELLED`
    - Booking status is `COMPLETED`

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

- Prevent double-booking of the same roster slot:
  - Allocation must lock candidate `roster_slots` rows (`FOR UPDATE SKIP LOCKED`) and only update rows still `status='AVAILABLE'`.
  - If reservation update affects fewer than 2 rows, treat as allocation failure and rollback.

- Concurrent booking attempts by same client:
  - DB partial unique index will reject the second insert; map this to 409 `CLIENT_ALREADY_HAS_NON_TERMINAL_BOOKING`.

- GET /bookings/{id}/details:
  - No row locks required; read-only operation.
  - Timing-based reveal uses server current time; concurrent reads may see different reveal states during the 5-hour threshold window (acceptable behavior).

14. Failure Cases

- `POST /bookings`
  - 400 `VALIDATION_ERROR` — missing/invalid `venueId` or `startAt`
  - 404 `VENUE_NOT_FOUND`
  - 409 `CLIENT_ALREADY_HAS_NON_TERMINAL_BOOKING`
  - 409 `NO_DUO_AVAILABLE` — fewer than 2 available roster slots for `[startAt,endAt)`
  - 500 `INTERNAL_ERROR`

- `GET /bookings/{id}/details`
  - 401 `UNAUTHORIZED` — missing or invalid Bearer token
  - 403 `FORBIDDEN` — caller is not the booking owner
  - 404 `BOOKING_NOT_FOUND`
  - 500 `INTERNAL_ERROR`

- `POST /bookings/{id}/cancel`
  - 401 `UNAUTHORIZED`
  - 403 `FORBIDDEN`
  - 403 `COMPANION_NOT_ASSIGNED` — caller is a companion but is not assigned to the booking
  - 404 `BOOKING_NOT_FOUND`
  - 400 `INVALID_STATE_TRANSITION` — e.g., cancel `COMPLETED`
  - 500 `INTERNAL_ERROR`

15. Side Effects

- On successful booking creation:
  - Send push notification to client: "Booking Confirmed".
  - Do NOT notify companions on booking creation.

- On cancellation:
  - Send push notifications to companions and client: "Booking Cancelled".

- On GET /bookings/{id}/details:
  - No side effects; read-only operation.

**Notification Architecture (Simple):**
- Provider: Expo Notifications (expo-notifications per tech-stack.md)
- Device token registration: Client app registers Expo Push Token on login (stored in user session or separate device_tokens table)
- Message format: JSON payload with `{ "event": "BOOKING_CONFIRMED"|"BOOKING_CANCELLED", "message": "string", "bookingId": "uuid" }`
- Delivery: Best-effort; no retry logic in Phase 1
- User preferences: No opt-out in Phase 1; all notifications are sent
- Implementation: Backend service calls Expo Push Notification API (https://docs.expo.dev/push-notifications/sending-notifications/) with Expo Push Tokens after booking creation/cancellation

16. Idempotency Rules

- `POST /bookings` is not idempotent.

- `GET /bookings/{id}/details`:
  - Idempotent by nature (read-only GET).
  - Successive calls within the T-5h threshold window may return different companion reveal states as time progresses (acceptable behavior per timing-based reveal rule).

- `POST /bookings/{id}/cancel`:
  - If booking is already `CANCELLED`, return 200 with `{id, status:'CANCELLED'}` (idempotent success).
  - If booking is `COMPLETED`, return 400 `INVALID_STATE_TRANSITION`.
