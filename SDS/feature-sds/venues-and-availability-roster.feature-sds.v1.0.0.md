Feature: Venues & Availability (Roster)
Version: 1.0.0
Status: Archived
Previous Version: None
Change Type: INITIAL
Change Summary: Initial version snapshot prior to adding read-by-id endpoint.
Created At: 2026-04-29T15:16:52Z
Last Edited At: 2026-04-29T15:38:43Z
Owner: Venues & Availability (Roster) Module

Feature: Venues & Availability (Roster)
Module: Venues & Availability (Roster)

1. Purpose

Provide:
- venue catalog search (partnered venues) including operating hours
- venue-based roster slot model for companion availability
- availability computation for 2-hour booking windows
- roster slot reservation/release semantics used by Booking creation/cancellation
- roster slot population/backfill for companions (next 7 days) when required
- companion-venue assignment management (companions can be rostered at multiple venues)

Source: `master-document/1.2_Booking_And_Allocation_Flow.md`
Alignment:
- `SDS/core_sds.md` (Venue + RosterSlot entities, availability invariant)
- `SDS/data-model/schema.md` (`venues`, `roster_slots`)

Key Ownership:
- This module owns roster slot creation, population, backfill, and reservation/release logic.
- Roster slots are independent of companion active/inactive status.

2. API Contract

A. `GET /venues?q={searchTerm}`
Autocomplete search across partnered venues.

B. `GET /availability?venueId={id}&date={YYYY-MM-DD}`
Returns available booking start times (2-hour windows) for a venue on a date, derived from roster slots and venue operating hours.

C. `POST /roster-slots/reserve` (Internal API - called by Booking module)
Reserves one CAPTAIN and one VICE_CAPTAIN for a specific venue and time window.

D. `POST /roster-slots/release` (Internal API - called by Booking module)
Releases roster slots for a cancelled booking.

E. `POST /roster-slots/populate-for-companion` (Internal API - called by Companion Profile module)
Populates roster slots for a newly signed-up companion for their assigned venues.

3. Input

A. `GET /venues`
- `q`: string (required) — search term

B. `GET /availability`
- `venueId`: uuid (required)
- `date`: string (required) — `YYYY-MM-DD` (Phase 1: timezone handling is out of scope; date is interpreted in server's local timezone)

C. `POST /roster-slots/reserve` (Internal)
- `venueId`: uuid (required)
- `startAt`: ISO-8601 timestamp (required)
- `endAt`: ISO-8601 timestamp (required)
- `bookingId`: uuid (required)

D. `POST /roster-slots/release` (Internal)
- `bookingId`: uuid (required)

E. `POST /roster-slots/populate-for-companion` (Internal)
- `companionId`: uuid (required)
- `venueIds`: uuid[] (required) — list of venues this companion is assigned to

4. Output

A. `GET /venues` (200)
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "string",
      "address": "string",
      "venueType": "MALL",
      "latitude": 0.0,
      "longitude": 0.0,
      "operatingHoursStart": "HH:MM",
      "operatingHoursEnd": "HH:MM"
    }
  ]
}
```

B. `GET /availability` (200)
```json
{
  "venueId": "uuid",
  "date": "YYYY-MM-DD",
  "durationMinutes": 120,
  "availableStartTimes": ["ISO-8601"]
}
```

C. `POST /roster-slots/reserve` (200)
```json
{
  "reserved": true,
  "captainSlotId": "uuid",
  "viceCaptainSlotId": "uuid"
}
```

D. `POST /roster-slots/release` (200)
```json
{
  "released": true,
  "slotsReleased": 2
}
```

E. `POST /roster-slots/populate-for-companion` (200)
```json
{
  "companionId": "uuid",
  "slotsCreated": 42
}
```

Error envelope (per Core SDS):
```json
{ "code": "string", "message": "string" }
```

5. Authorization Rules

- `GET /venues`, `GET /availability`: Requires Bearer token authentication. Accessible to both `role=CLIENT` and `role=COMPANION`.
- `POST /roster-slots/reserve`, `POST /roster-slots/release`: Internal APIs, requires service-to-service authentication or admin token.
- `POST /roster-slots/populate-for-companion`: Internal API, called by Companion Profile module after successful companion signup.

6. Preconditions

A. `GET /venues`
- Authenticated user exists.

B. `GET /availability`
- Authenticated user exists.
- `venueId` references an existing venue.
- Roster slot population is owned by this module:
  - If roster slots required for the venue/day are missing, the system backfills them before computing availability.
  - Only companions with a record in `companion_venue_assignments` for the requested venue are considered for backfill.

C. `POST /roster-slots/reserve`
- `venueId`, `startAt`, `endAt`, and `bookingId` are valid.
- At least one CAPTAIN and one VICE_CAPTAIN (both assigned to the venue) have AVAILABLE roster slots for the exact window.

D. `POST /roster-slots/release`
- `bookingId` references an existing booking.

E. `POST /roster-slots/populate-for-companion`
- `companionId` references a valid companion user.
- `venueIds` contains valid venue IDs.
- Creates entries in `companion_venue_assignments` and corresponding roster slots.

7. Data Access Mapping

- `venues`
  - `id`, `name`, `address`, `venue_type`, `latitude`, `longitude`, `operating_hours_start`, `operating_hours_end`

- `roster_slots`
  - `id`, `venue_id`, `companion_id`, `booking_id`, `start_at`, `end_at`, `status`

- `companion_profiles`
  - `user_id`, `designation` (used for duo pairing: CAPTAIN + VICE_CAPTAIN)

- `companion_venue_assignments`
  - `companion_id`, `venue_id` (used to determine which companions are rostered for which venues)

8. Business Logic

A. `GET /venues`
1. Authenticate request.
2. Validate `q` is present and non-empty after trim.
3. Query partnered venues by name (case-insensitive substring match) limited to a reasonable cap (e.g., 20).
4. Return list of venues with fields needed by booking flow (name/address/type/hours) and by GPS checks later (lat/long).

B. `GET /availability`
Definition (from 1.2.1.1.7): a start time is available if a companion duo (one CAPTAIN + one VICE_CAPTAIN) is available at that venue for the next 2 hours from that start time, intersected with venue operating hours.

Algorithm:
1. Authenticate request.
2. Validate `venueId` and `date`.
3. Load venue operating hours (`operating_hours_start`, `operating_hours_end`).
3.1 Ensure roster slots exist (backfill if missing):
  - Query `companion_venue_assignments` to find all companions assigned to the requested venue.
  - For each assigned companion, for each eligible 2-hour window on the requested date:
    - Eligible windows start on 30-minute boundaries (e.g., 10:00, 10:30, 11:00) within venue operating hours.
  - If slots are missing for a companion/venue/window combination, insert them as AVAILABLE with booking_id=NULL.
  - Use upsert semantics to avoid duplicates (unique index on venue_id, companion_id, start_at, end_at).
4. Compute the candidate window bounds for the date:
   - `openAt = combine(date, operating_hours_start)` (using server's local timezone)
   - `closeAt = combine(date, operating_hours_end)` (using server's local timezone)
   - A 2-hour booking starting at `t` is eligible only if:
     - `t >= openAt`
     - `t + 2 hours <= closeAt`
     - `t` is aligned to a 30-minute boundary
5. Query roster slots for the venue on that date where:
   - `status='AVAILABLE'`
   - `start_at >= openAt`
   - `end_at <= closeAt`
   - `end_at - start_at = 2 hours` (roster slots are defined in exact 2-hour windows)
6. Derive availability start times by grouping roster slots by candidate `[start_at, end_at)` window:
   - For each unique window, join with `companion_profiles` to get designation.
   - Count distinct companions per designation: `countCaptains`, `countViceCaptains`.
   - A window is available if `countCaptains >= 1 AND countViceCaptains >= 1` (duo integrity: one CAPTAIN + one VICE_CAPTAIN).
7. Return `availableStartTimes` sorted ascending, using the window `start_at` values.

C. `POST /roster-slots/reserve`
Reservation semantics (called by Booking & Allocation module):
1. Validate input.
2. Begin transaction.
3. Select one CAPTAIN slot:
   - `SELECT id, companion_id FROM roster_slots
      JOIN companion_profiles ON roster_slots.companion_id = companion_profiles.user_id
      WHERE venue_id = $venueId
        AND start_at = $startAt
        AND end_at = $endAt
        AND status = 'AVAILABLE'
        AND companion_profiles.designation = 'CAPTAIN'
      LIMIT 1
      FOR UPDATE SKIP LOCKED`
4. Select one VICE_CAPTAIN slot:
   - Same query, but `designation = 'VICE_CAPTAIN'`
5. If either slot is not found, return 409 NO_DUO_AVAILABLE.
6. Update both slots:
   - `UPDATE roster_slots SET status = 'BOOKED', booking_id = $bookingId WHERE id IN ($captainSlotId, $viceCaptainSlotId)`
7. Commit transaction.
8. Return success with slot IDs.

D. `POST /roster-slots/release`
Release semantics (called by Booking & Allocation module):
1. Validate `bookingId`.
2. Update all roster slots for the booking:
   - `UPDATE roster_slots SET status = 'AVAILABLE', booking_id = NULL WHERE booking_id = $bookingId`
3. Return count of slots released.

E. `POST /roster-slots/populate-for-companion`
Population semantics (called by Companion Profile module after signup):
1. Validate `companionId` and `venueIds`.
2. For each venue in `venueIds`:
   - Insert companion-venue assignment:
     - `INSERT INTO companion_venue_assignments (companion_id, venue_id, assigned_at)
        VALUES ($companionId, $venueId, now())
        ON CONFLICT (companion_id, venue_id) DO NOTHING`
3. For each venue in `venueIds`:
   - Load venue operating hours.
   - For the next 7 days (from today):
     - For each eligible 2-hour window on 30-minute boundaries within operating hours:
       - `INSERT INTO roster_slots (id, venue_id, companion_id, booking_id, start_at, end_at, status)
          VALUES (uuid_generate_v4(), $venueId, $companionId, NULL, $startAt, $endAt, 'AVAILABLE')
          ON CONFLICT (venue_id, companion_id, start_at, end_at) DO NOTHING`
4. Return total count of slots created.

9. State Changes

- `roster_slots.status` changes occur only when reserving/releasing for a booking:
  - `AVAILABLE → BOOKED` on reservation
  - `BOOKED → AVAILABLE` on release

- `venues` are read-only for this module.

10. DB Operations

A. `GET /venues`
- `SELECT id, name, address, venue_type, latitude, longitude, operating_hours_start, operating_hours_end
   FROM venues
   WHERE name ILIKE '%' || $1 || '%'
   ORDER BY name ASC
   LIMIT $2`

B. `GET /availability`
- Load venue:
  - `SELECT id, operating_hours_start, operating_hours_end FROM venues WHERE id = $1`

- Get companions assigned to the venue:
  - `SELECT companion_id FROM companion_venue_assignments WHERE venue_id = $1`

- Backfill roster slots for missing windows (for companions assigned to the requested venue):
  - For each companion assigned to the venue, for each eligible 2-hour window on the requested date:
    - Windows start on 30-minute boundaries within venue operating hours.
    - `INSERT INTO roster_slots (id, venue_id, companion_id, booking_id, start_at, end_at, status)
       VALUES (uuid_generate_v4(), $venueId, $companionId, NULL, $startAt, $endAt, 'AVAILABLE')
       ON CONFLICT (venue_id, companion_id, start_at, end_at) DO NOTHING`

- Derive available windows (requires at least one CAPTAIN and one VICE_CAPTAIN per window):
  - `SELECT rs.start_at, rs.end_at,
       COUNT(DISTINCT CASE WHEN cp.designation = 'CAPTAIN' THEN rs.companion_id END) AS captain_count,
       COUNT(DISTINCT CASE WHEN cp.designation = 'VICE_CAPTAIN' THEN rs.companion_id END) AS vice_captain_count
     FROM roster_slots rs
     JOIN companion_profiles cp ON rs.companion_id = cp.user_id
     WHERE rs.venue_id = $1
       AND rs.status = 'AVAILABLE'
       AND rs.start_at >= $2
       AND rs.end_at <= $3
     GROUP BY rs.start_at, rs.end_at
     HAVING COUNT(DISTINCT CASE WHEN cp.designation = 'CAPTAIN' THEN rs.companion_id END) >= 1
        AND COUNT(DISTINCT CASE WHEN cp.designation = 'VICE_CAPTAIN' THEN rs.companion_id END) >= 1
     ORDER BY rs.start_at ASC`

C. Reserve (POST /roster-slots/reserve)
- Select CAPTAIN slot:
  - `SELECT rs.id, rs.companion_id
     FROM roster_slots rs
     JOIN companion_profiles cp ON rs.companion_id = cp.user_id
     WHERE rs.venue_id = $1
       AND rs.start_at = $2
       AND rs.end_at = $3
       AND rs.status = 'AVAILABLE'
       AND cp.designation = 'CAPTAIN'
     LIMIT 1
     FOR UPDATE SKIP LOCKED`

- Select VICE_CAPTAIN slot:
  - `SELECT rs.id, rs.companion_id
     FROM roster_slots rs
     JOIN companion_profiles cp ON rs.companion_id = cp.user_id
     WHERE rs.venue_id = $1
       AND rs.start_at = $2
       AND rs.end_at = $3
       AND rs.status = 'AVAILABLE'
       AND cp.designation = 'VICE_CAPTAIN'
     LIMIT 1
     FOR UPDATE SKIP LOCKED`

- Update both slots:
  - `UPDATE roster_slots
     SET status = 'BOOKED', booking_id = $bookingId
     WHERE id IN ($captainSlotId, $viceCaptainSlotId) AND status = 'AVAILABLE'`

D. Release (POST /roster-slots/release)
- `UPDATE roster_slots
   SET status = 'AVAILABLE', booking_id = NULL
   WHERE booking_id = $bookingId`

E. Populate (POST /roster-slots/populate-for-companion)
- Insert companion-venue assignments:
  - `INSERT INTO companion_venue_assignments (companion_id, venue_id, assigned_at)
     VALUES ($companionId, $venueId, now())
     ON CONFLICT (companion_id, venue_id) DO NOTHING`

- Batch insert roster slots for the next 7 days for each assigned venue:
  - `INSERT INTO roster_slots (id, venue_id, companion_id, booking_id, start_at, end_at, status)
     VALUES (uuid_generate_v4(), $venueId, $companionId, NULL, $startAt, $endAt, 'AVAILABLE')
     ON CONFLICT (venue_id, companion_id, start_at, end_at) DO NOTHING`

11. Transaction Boundaries

- `GET /venues`: no transaction required.
- `GET /availability`: no transaction required (backfill uses upsert with conflict handling).
- `POST /roster-slots/reserve`: MUST run in a transaction (BEGIN → SELECT FOR UPDATE → UPDATE → COMMIT).
- `POST /roster-slots/release`: single UPDATE, no explicit transaction required (idempotent).
- `POST /roster-slots/populate-for-companion`: batch insert with conflict handling, no explicit transaction required.

Note: When called by the Booking module, reserve/release should be part of the caller's booking transaction to guarantee atomicity.

12. Constraints

- Availability duration is fixed at 2 hours (`durationMinutes=120`).
- Venue operating hours must be enforced such that a returned start time `t` satisfies `t+2h <= closeAt`.
- **Phase 1 timezone rule:**
  - **Timezone handling is OUT OF SCOPE for Phase 1.**
  - `date` is interpreted in the server's local timezone.
  - `combine(date, operating_hours_*)` uses server's local timezone.
  - No cross-midnight operating hours are supported; if `operating_hours_end <= operating_hours_start`, treat venue hours as invalid for availability.

- **Time Slot Granularity:**
  - Roster slot start times are aligned to **30-minute intervals** (e.g., 10:00, 10:30, 11:00, 11:30, etc.).
  - A 2-hour window starting at time `T` occupies the interval `[T, T+2h)`.
  - Only start times on 30-minute boundaries within venue operating hours are eligible for availability.

- **Roster Slot Population:**
  - On companion signup, the Companion Profile module calls `POST /roster-slots/populate-for-companion` with the companion's assigned venue IDs.
  - This module creates roster slots for the next 7 days (from today) for each assigned venue.
  - On availability read, this module backfills any missing roster slots for the requested venue and date before computing availability.
  - New slots are created as `status='AVAILABLE'` and `booking_id=NULL`.

- **Companion-Venue Assignment:**
  - Companions can be rostered at multiple venues.
  - Companion-venue assignments are managed by the Companion Profile module and passed to this module via `venueIds` parameter in the populate API.
  - Only companions assigned to a venue contribute to availability for that venue.

- **Active/Inactive Status:**
  - Roster slots are independent of companion active/inactive status (`companion_profiles.is_active`).
  - Roster slots remain in the database regardless of active status.
  - Active status enforcement is handled by the Booking & Allocation module during companion assignment, not by roster availability.

13. Concurrency Rules

- Availability reads can be slightly stale; final correctness is enforced at booking creation by row locks on `roster_slots`.
- Reservation must use row-level locking (`FOR UPDATE SKIP LOCKED`) and a conditional update (`... AND status='AVAILABLE'`) to avoid double-booking.
- Reservation must lock and reserve exactly one CAPTAIN and one VICE_CAPTAIN to satisfy duo integrity.
- If either designation is unavailable after locking, the reservation fails with 409 NO_DUO_AVAILABLE.

14. Failure Cases

- `GET /venues`
  - 400 `VALIDATION_ERROR` — missing/empty `q`
  - 401 `UNAUTHORIZED`
  - 500 `INTERNAL_ERROR`

- `GET /availability`
  - 400 `VALIDATION_ERROR` — invalid/missing `venueId` or `date`
  - 401 `UNAUTHORIZED`
  - 404 `VENUE_NOT_FOUND`
  - 500 `INTERNAL_ERROR`

- `POST /roster-slots/reserve`
  - 400 `VALIDATION_ERROR` — invalid input parameters
  - 401 `UNAUTHORIZED` — invalid service authentication
  - 409 `NO_DUO_AVAILABLE` — unable to lock one CAPTAIN and one VICE_CAPTAIN for the requested window
  - 500 `INTERNAL_ERROR`

- `POST /roster-slots/release`
  - 400 `VALIDATION_ERROR` — invalid `bookingId`
  - 401 `UNAUTHORIZED`
  - 500 `INTERNAL_ERROR`

- `POST /roster-slots/populate-for-companion`
  - 400 `VALIDATION_ERROR` — invalid `companionId` or `venueIds`
  - 401 `UNAUTHORIZED`
  - 404 `COMPANION_NOT_FOUND` or `VENUE_NOT_FOUND`
  - 500 `INTERNAL_ERROR`

15. Side Effects

- `GET /venues`: None.
- `GET /availability`: May backfill roster slots (creates new AVAILABLE slots for missing windows).
- `POST /roster-slots/reserve`: Updates two roster_slots rows to status=BOOKED with booking_id set.
- `POST /roster-slots/release`: Updates all roster_slots for the booking to status=AVAILABLE with booking_id=NULL.
- `POST /roster-slots/populate-for-companion`: Creates new roster_slots rows for the companion's assigned venues.

16. Idempotency Rules

- `GET /venues`: idempotent.
- `GET /availability`: idempotent (backfill uses ON CONFLICT DO NOTHING, so repeated calls are safe).
- `POST /roster-slots/reserve`: NOT idempotent; repeated calls will fail after the first success (slots already BOOKED).
- `POST /roster-slots/release`: idempotent (releasing already-available slots has no effect; WHERE clause filters by booking_id).
- `POST /roster-slots/populate-for-companion`: idempotent (uses ON CONFLICT DO NOTHING; repeated calls are safe).
