Feature: Venues & Availability (Roster)
Version: 1.1.0
Status: Archived
Previous Version: venues-and-availability-roster.feature-sds.v1.0.0.md
Change Type: MINOR
Change Summary: Add GET /venues/{venueId} (Bearer auth) returning same fields as venue list item.
Created At: 2026-04-29T15:16:52Z
Last Edited At: 2026-04-29T15:16:52Z
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

B. `GET /venues/{venueId}`
Returns a single venue record by id (same fields as a venue list item).

C. `GET /availability?venueId={id}&date={YYYY-MM-DD}`
Returns available booking start times (2-hour windows) for a venue on a date, derived from roster slots and venue operating hours.

D. `POST /roster-slots/reserve` (Internal API - called by Booking module)
Reserves one CAPTAIN and one VICE_CAPTAIN for a specific venue and time window.

E. `POST /roster-slots/release` (Internal API - called by Booking module)
Releases roster slots for a cancelled booking.

F. `POST /roster-slots/populate-for-companion` (Internal API - called by Companion Profile module)
Populates roster slots for a newly signed-up companion for their assigned venues.

3. Input

A. `GET /venues`
- `q`: string (required) — search term

B. `GET /venues/{venueId}`
- Path param: `{venueId}` uuid (required)

C. `GET /availability`
- `venueId`: uuid (required)
- `date`: string (required) — `YYYY-MM-DD` (Phase 1: timezone handling is out of scope; date is interpreted in server's local timezone)

D. `POST /roster-slots/reserve` (Internal)
- `venueId`: uuid (required)
- `startAt`: ISO-8601 timestamp (required)
- `endAt`: ISO-8601 timestamp (required)
- `bookingId`: uuid (required)

E. `POST /roster-slots/release` (Internal)
- `bookingId`: uuid (required)

F. `POST /roster-slots/populate-for-companion` (Internal)
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

B. `GET /venues/{venueId}` (200)
```json
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
```

C. `GET /availability` (200)
```json
{
  "venueId": "uuid",
  "date": "YYYY-MM-DD",
  "durationMinutes": 120,
  "availableStartTimes": ["ISO-8601"]
}
```

D. `POST /roster-slots/reserve` (200)
```json
{
  "reserved": true,
  "captainSlotId": "uuid",
  "viceCaptainSlotId": "uuid"
}
```

E. `POST /roster-slots/release` (200)
```json
{
  "released": true,
  "slotsReleased": 2
}
```

F. `POST /roster-slots/populate-for-companion` (200)
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

- `GET /venues`, `GET /venues/{venueId}`, `GET /availability`: Requires Bearer token authentication. Accessible to both `role=CLIENT` and `role=COMPANION`.
- `POST /roster-slots/reserve`, `POST /roster-slots/release`: Internal APIs, requires service-to-service authentication or admin token.
- `POST /roster-slots/populate-for-companion`: Internal API, called by Companion Profile module after successful companion signup.

6. Preconditions

A. `GET /venues`
- Authenticated user exists.

B. `GET /venues/{venueId}`
- Authenticated user exists.
- `venueId` references an existing venue.

C. `GET /availability`
- Authenticated user exists.
- `venueId` references an existing venue.
- Roster slot population is owned by this module:
  - If roster slots required for the venue/day are missing, the system backfills them before computing availability.
  - Only companions with a record in `companion_venue_assignments` for the requested venue are considered for backfill.

D. `POST /roster-slots/reserve`
- `venueId`, `startAt`, `endAt`, and `bookingId` are valid.
- At least one CAPTAIN and one VICE_CAPTAIN (both assigned to the venue) have AVAILABLE roster slots for the exact window.

E. `POST /roster-slots/release`
- `bookingId` references an existing booking.

F. `POST /roster-slots/populate-for-companion`
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
4. Return list of venues with fields needed by booking flow and GPS checks (lat/long).

B. `GET /venues/{venueId}`
1. Authenticate request.
2. Validate `venueId` is a uuid.
3. Fetch venue by id.
4. If not found: return 404 `VENUE_NOT_FOUND`.
5. Return venue fields (same as venue list item).

C. `GET /availability`
(unchanged algorithm per prior version; computes eligible 2-hour windows from roster slots + venue hours, backfilling if needed)

D/E/F. Internal roster APIs
(unchanged semantics per prior version)

9. State Changes

- `roster_slots.status` changes occur only when reserving/releasing for a booking.
- `venues` are read-only for this module.

10. DB Operations

A. `GET /venues`
- `SELECT id, name, address, venue_type, latitude, longitude, operating_hours_start, operating_hours_end
   FROM venues
   WHERE name ILIKE '%' || $1 || '%'
   ORDER BY name ASC
   LIMIT $2`

B. `GET /venues/{venueId}`
- `SELECT id, name, address, venue_type, latitude, longitude, operating_hours_start, operating_hours_end
   FROM venues
   WHERE id = $1`

C. `GET /availability`
- Load venue hours; derive available windows via roster_slots + companion_profiles.designation.

11. Transaction Boundaries

- GET endpoints: no transaction required.
- Reserve: MUST be transactional (row locking).

12. Constraints

- Availability duration fixed at 2 hours.
- Phase 1 timezone rule unchanged.

13. Concurrency Rules

- Availability reads can be slightly stale; final correctness enforced at booking creation by locks.

14. Failure Cases

- `GET /venues`
  - 400 `VALIDATION_ERROR`
  - 401 `UNAUTHORIZED`
  - 500 `INTERNAL_ERROR`

- `GET /venues/{venueId}`
  - 401 `UNAUTHORIZED`
  - 404 `VENUE_NOT_FOUND`
  - 500 `INTERNAL_ERROR`

- `GET /availability`
  - 400 `VALIDATION_ERROR`
  - 401 `UNAUTHORIZED`
  - 404 `VENUE_NOT_FOUND`
  - 500 `INTERNAL_ERROR`

15. Side Effects

- `GET /venues/{venueId}`: none.

16. Idempotency Rules

- `GET /venues`: idempotent.
- `GET /venues/{venueId}`: idempotent.
- `GET /availability`: idempotent.
