Feature: Booking & Allocation
Module: Booking & Allocation

1. Purpose

Implement booking creation and allocation of a companion duo (Captain + Vice Captain) from a venue-based roster, enforce the “one non-terminal booking per client” rule, and support cancellation (pre-session and in-session) with roster release.

Dependencies / Assumptions:
- Venue selection and availability/time-slot selection are handled upstream (separate CDC). This module expects `venueId` and `startAt` to be provided from those pages and treats missing/invalid values as a request validation error.
- In this version, server-side validation for “startAt is in the future” and “within venue operating hours” is not enforced here; upstream availability only returns valid future slots.
- Venues & Availability module owns roster slot population/backfill. Roster slots for the coming week are created for each companion at signup and backfilled if missing (see Constraints).
- Admin reassignment (1.2.4.2) is deferred and not implemented in this version.

Source: `master-document/1.2_Booking_And_Allocation_Flow.md`
Alignment:
- `SDS/core_sds.md` (Booking lifecycle + invariants)
- `SDS/data-model/schema.md` (`bookings`, `roster_slots`, `booking_companion_assignments`, partial unique index enforcing one non-terminal booking)

2. API Contract

A. `POST /bookings`
Creates a booking for a venue and start time, allocates an available duo from the roster, reserves roster slots, and returns booking id with `CONFIRMED` status.

B. `POST /bookings/{id}/cancel`
Cancels a booking in `CONFIRMED` or `ACTIVE` state, releases reserved roster slots, and returns the updated booking status.

3. Input

A. `POST /bookings` (JSON)
- `venueId`: uuid (required)
- `startAt`: ISO-8601 timestamp (required)

Notes:
- Duration is fixed (2 hours) per 1.2.1.1.9 and Core SDS; client only selects a start time.

B. `POST /bookings/{id}/cancel` (JSON)
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

B. `POST /bookings/{id}/cancel` (200)
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

7. Data Access Mapping

- `bookings`
  - `id`, `client_id`, `venue_id`, `start_at`, `end_at`, `status`, `qr_code`, `pin_code`, `booking_color`, `com_match_qr_code`, `com_match_pin_code`, `extended_at`, `created_at`
- `roster_slots`
  - `id`, `venue_id`, `companion_id`, `booking_id`, `start_at`, `end_at`, `status`
- `booking_companion_assignments`
  - `id`, `booking_id`, `companion_id`, `designation`, `presence_status`, `self_match_status`, `client_match_status`

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

9. State Changes

- Booking status:
  - On create: `CONFIRMED`
  - On cancel (pre-session): `CONFIRMED → CANCELLED`
  - On cancel (in-session): `ACTIVE → CANCELLED`

- RosterSlot status:
  - On create: `AVAILABLE → BOOKED` (for the two selected slots)
  - On cancel: `BOOKED → AVAILABLE` (for slots linked to the cancelled booking)

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

B. `POST /bookings/{id}/cancel`
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

B. `POST /bookings/{id}/cancel`
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

15. Side Effects

- On successful booking creation:
  - Send push notification to client: "Booking Confirmed".
  - Do NOT notify companions on booking creation.

- On cancellation:
  - Send push notifications to companions and client: "Booking Cancelled".

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
