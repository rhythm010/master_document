Feature: Session In Progress
Version: 1.0.0
Status: Current
Previous Version: None (initial release)
Change Type: MAJOR
Change Summary: Initial Session In-Progress SDS (ACTIVE→COMPLETED): extend once, end early via cancel (client-only for ACTIVE), SOS stub, captain↔vice chat via HTTP polling, 15-min near-end notification with exactly-once guard, auto-end, and 300m breach monitoring.
Created At: 2026-05-03T06:48:18Z
Last Edited At: 2026-05-03T08:15:00Z
Owner: Session In Progress Module

Feature: Session In Progress
Module: Session In Progress

1. Purpose

Define backend/API + scheduler behavior for the in-session experience from Booking status `ACTIVE` through `COMPLETED`, including:
- Client view: countdown timer; static companion info; extend once (+1 hour); end early via existing cancel; SOS stub.
- Companion view: countdown; designation (Captain/Vice Captain); Captain↔Vice-only chat using HTTP polling.
- APIs:
  - PATCH /bookings/{id}/extend (new)
  - POST /bookings/{id}/sos (new stub)
  - GET /bookings/{id}/messages (new)
  - POST /bookings/{id}/messages (new)
  - GET /bookings/{id}/session (new; companion+client timing/status for countdown)
  - Reuse POST /bookings/{id}/matching/location (existing)
  - Reuse POST /bookings/{id}/cancel (existing; client-only for ACTIVE)
- Schedulers:
  - session-auto-end
  - near-end-notification
  - companion-300m-breach-check
- Schema:
  - `bookings.near_end_notified_at` (nullable timestamptz)
  - `booking_messages` table (id, booking_id, sender_user_id, message_text, created_at)
    - API field mapping:
      - Request: `content` → DB column `message_text`
      - Response: `senderUserId` ↔ DB column `sender_user_id`
    - Sender derivation: `senderUserId` MUST be derived from the Bearer token (`auth.userId`) and MUST NOT be accepted in the request body.

Alignment:
- `SDS/core_sds.md` (Booking lifecycle + extension invariants)
- `SDS/data-model/schema.md` (existing `booking_participant_locations`, `booking_sos_events`; base booking/assignment tables)
- `master-document/1.5_Session_In_Progress_Flow.md` (legacy narrative; partially outdated)
- Approved requirement artifact: `SDS/artifacts/TASK-20260503-001-clarity.json`

Deviations from `master-document/1.5_Session_In_Progress_Flow.md` (authoritative via the approved clarity artifact):
- Timer semantics: countdown (time remaining) derived from `endAt - now`, not count-up time elapsed.
- SOS: stub only (200 OK, no side effects). Admin alerting/in-app support is deferred.
- 300m monitoring: breach distance is companion-to-venue (not companion-to-client).

2. API Contract

A. `PATCH /bookings/{id}/extend` (NEW)
Extends an `ACTIVE` booking by exactly +1 hour. Allowed at most once per booking.

B. `POST /bookings/{id}/sos` (NEW stub)
Stub-only SOS acknowledgement endpoint.
- Returns 200 OK.
- No side effects: no DB writes, no admin alert, no notifications.

C. `GET /bookings/{id}/messages` (NEW)
Returns Captain↔Vice messages for an `ACTIVE` booking. Designed for HTTP polling.

D. `POST /bookings/{id}/messages` (NEW)
Creates a new Captain↔Vice message for an `ACTIVE` booking.

E. `POST /bookings/{id}/matching/location` (EXISTING — reused)
Used by booking participants to post location updates. This feature relies on it for companion GPS posting during `ACTIVE`.
Minimal contract (for this feature scope):
- Allowed callers: booking owner client OR companions assigned to the booking
- Allowed booking status: `ACTIVE`
- Body (JSON): `{ "latitude": number, "longitude": number }`
- Response: 200 OK `{}`

F. `POST /bookings/{id}/cancel` (EXISTING — reused)
Used by client to end an `ACTIVE` booking early ("end early"). For `ACTIVE`, companions are not authorized.

G. `GET /bookings/{id}/session` (NEW)
Used by the booking owner client and assigned companions to read authoritative session timing/status during `ACTIVE` (for countdown + extension visibility).

H. `GET /bookings/{id}/details` (EXISTING — reused; Booking & Allocation)
Client-only booking details endpoint used as the authoritative source of static companion info (name/photo) during `ACTIVE`.
This SDS does not modify that contract; see `SDS/feature-sds/booking-and-allocation.feature-sds.md`.

3. Input

A. `PATCH /bookings/{id}/extend`
- Path param: `id` (uuid) — booking id
- Body: none (or empty JSON `{}`)

B. `POST /bookings/{id}/sos`
- Path param: `id` (uuid)
- Body: none (or empty JSON `{}`)

C. `GET /bookings/{id}/messages`
- Path param: `id` (uuid)
- Query params: none (MVP).
- Returns the booking-scoped message history.
  - Rationale/assumption (from approved clarity artifact): sessions are time-bounded (2–3 hours) and chat is restricted to 2 companions (Captain/Vice), so expected message volume is limited for MVP.
- Ordering: `(createdAt ASC, id ASC)`
  - `createdAt` is derived from DB `booking_messages.created_at` (timestamptz UTC). `id` is a deterministic tie-breaker only.
- Polling behavior: the companion app may poll every 3–5 seconds; companion app/caller SHOULD de-duplicate by message `id`.
- Server protection note (non-normative): apply rate limiting to prevent abusive high-frequency polling.
- No body

D. `POST /bookings/{id}/messages`
- Path param: `id` (uuid)
- Body (JSON):
  - `content`: string (required)
- Request rule: MUST NOT accept `senderUserId` in the request body. Sender is derived from Bearer token (`auth.userId`). If `senderUserId` is present: return 400 `VALIDATION_ERROR`.

E. `POST /bookings/{id}/matching/location` (reused)
- Path param: `id` (uuid)
- Body (JSON):
  - `latitude`: number (required)
  - `longitude`: number (required)
- Allowed callers (Bearer): booking owner client OR assigned companions
- Allowed booking status: `ACTIVE`
- Response: 200 OK `{}`

F. `POST /bookings/{id}/cancel` (reused)
- Inputs as per `SDS/feature-sds/booking-and-allocation.feature-sds.md`.

G. `GET /bookings/{id}/session` (new)
- Path param: `id` (uuid)
- No body

4. Output

A. `PATCH /bookings/{id}/extend` (200)
- Returns booking summary (minimum):
  - `id`: uuid
  - `status`: "ACTIVE"
  - `endAt`: ISO-8601
  - `extendedAt`: ISO-8601 (now)

B. `POST /bookings/{id}/sos` (200)
- Returns empty JSON acknowledgement: `{}`

C. `GET /bookings/{id}/messages` (200)
- Returns:
  - `bookingId`: uuid
  - `messages`: array of
    - `id`: uuid
    - `senderUserId`: uuid
    - `content`: string
    - `createdAt`: ISO-8601

D. `POST /bookings/{id}/messages` (201)
- Returns created message:
  - `id`, `bookingId`, `senderUserId`, `content`, `createdAt`

E. `GET /bookings/{id}/session` (200)
- Returns:
  - `id`: uuid
  - `status`: "ACTIVE" | "COMPLETED" | "CANCELLED"
  - `startAt`: ISO-8601
  - `endAt`: ISO-8601
  - `extendedAt`: ISO-8601 | null
  - `nearEndNotifiedAt`: ISO-8601 | null
  - `myDesignation`: "CAPTAIN" | "VICE_CAPTAIN" | null (always present; null for client callers)

Error envelope (per Core SDS):
- `{ code: string, message: string }`

5. Authorization Rules

All endpoints require Bearer token authentication.

A. `PATCH /bookings/{id}/extend`
- Allowed caller: CLIENT who owns the booking (`bookings.client_id == auth.userId`).

B. `POST /bookings/{id}/sos`
- Validation/authorization: reject (403) if caller is NOT:
  - booking owner client, OR
  - companion assigned to the booking

C. `GET /bookings/{id}/messages` and `POST /bookings/{id}/messages`
- Allowed callers: companions assigned to the booking (Captain or Vice Captain only).
- Client is explicitly NOT allowed.

D. `GET /bookings/{id}/session`
- Allowed callers: booking owner client OR companions assigned to the booking.

Schedulers:
- All scheduler jobs are internal (no external caller).

6. Preconditions

Global:
- Booking must exist.
- Booking must be in status `ACTIVE` unless explicitly stated otherwise.

A. `PATCH /bookings/{id}/extend`
- Booking status MUST be `ACTIVE`.
- Booking MUST NOT be extended already (`bookings.extended_at IS NULL`).
- Authenticated user role MUST be CLIENT and must own the booking.

B. `POST /bookings/{id}/sos`
- Booking must exist.
- Booking status MUST be `ACTIVE`.
- Stub-only: still returns 200 OK with no side effects when allowed.
- Caller must be booking owner client OR assigned companion.

C. Messages endpoints
- Booking status MUST be `ACTIVE`.
- Caller must be an assigned companion (CAPTAIN or VICE_CAPTAIN) for the booking.

D. `GET /bookings/{id}/session`
- Booking must exist.
- Booking status MUST be one of: `ACTIVE`, `COMPLETED`, `CANCELLED`.
  - If status is `CONFIRMED` (pre-session), return 400 `INVALID_STATE_TRANSITION` (not an in-progress session).
- Caller must be booking owner client OR assigned companion.

E. Schedulers
- session-auto-end considers only `ACTIVE` bookings.
- near-end-notification considers only `ACTIVE` bookings with `near_end_notified_at IS NULL`.
- companion-300m-breach-check considers only `ACTIVE` bookings.

7. Data Access Mapping

Tables used (existing):
- `bookings`
  - `id`, `client_id`, `venue_id`, `start_at`, `end_at`, `status`, `extended_at`, `near_end_notified_at`
- `booking_companion_assignments`
  - `booking_id`, `companion_id`, `designation`
- `venues`
  - `id`, `latitude`, `longitude`
- `booking_participant_locations`
  - `booking_id`, `user_id`, `latitude`, `longitude`, `updated_at`
- `booking_sos_events`
  - `id`, `booking_id`, `triggered_by_user_id`, `created_at`
  - NOTE: not used by the SOS stub in this version (no DB writes).
- `booking_messages`
  - `id`, `booking_id`, `sender_user_id`, `message_text`, `created_at`
  - Performance note (non-normative): an index on `(booking_id, created_at, id)` best supports the polling query pattern.
  - API mapping:
    - Request: `content` (JSON) → `message_text` (DB)
    - Response: `senderUserId` (JSON) ↔ `sender_user_id` (DB)

8. Business Logic

A. `PATCH /bookings/{id}/extend`
1. Authenticate (Bearer).
2. Begin DB transaction.
3. Lock booking row: `SELECT ... FROM bookings WHERE id=$id FOR UPDATE`.
4. Validate booking exists; else 404 `BOOKING_NOT_FOUND`.
5. Validate booking status is `ACTIVE`; else 400 `INVALID_STATE_TRANSITION`.
6. Authorize: caller must be CLIENT and must own booking; else 403 `FORBIDDEN`.
7. Validate `bookings.extended_at IS NULL`; else 400 `INVALID_STATE_TRANSITION`.
8. Apply extension (Core SDS invariant):
   - `bookings.end_at = bookings.end_at + interval '1 hour'`
   - `bookings.extended_at = now()`
9. Commit transaction.
10. Return updated booking summary.

B. `POST /bookings/{id}/sos` (stub)
1. Authenticate (Bearer).
2. Fetch booking by id.
3. If booking does not exist: return 404 `BOOKING_NOT_FOUND`.
4. Validate booking status is `ACTIVE`; else 400 `INVALID_STATE_TRANSITION`.
5. Authorize caller:
   - allow if `bookings.client_id == auth.userId`, OR
   - allow if caller is an assigned companion for the booking (exists `booking_companion_assignments` row for `booking_id=$id` and `companion_id=auth.userId`).
6. If not authorized: return 403 `FORBIDDEN`.
7. Return 200 OK with `{}`.

C. `GET /bookings/{id}/messages`
1. Authenticate (Bearer).
2. Validate booking exists.
3. Validate booking status is `ACTIVE`.
4. Authorize caller must be assigned companion.
5. Query booking messages by booking id ordered by `(created_at ASC, id ASC)`.
6. Return messages; map DB `message_text` → API field `content`.
   - Companion app/caller SHOULD de-duplicate by message `id` when polling.

D. `POST /bookings/{id}/messages`
1. Authenticate (Bearer).
2. Validate booking exists.
3. Validate booking status is `ACTIVE`.
4. Authorize caller must be assigned companion.
5. Validate input: `content` present.
6. Reject if request body includes `senderUserId` (MUST NOT be accepted); return 400 `VALIDATION_ERROR`.
7. Derive sender: `senderUserId = auth.userId`.
8. Insert message row into `booking_messages` with:
   - `booking_id = id`
   - `sender_user_id = auth.userId`
   - `message_text = content`
9. Return created message with mapping:
   - API `senderUserId` = DB `sender_user_id`
   - API `content` = DB `message_text`

D2. `GET /bookings/{id}/session`
1. Authenticate (Bearer).
2. Fetch booking by id.
3. If booking does not exist: return 404 `BOOKING_NOT_FOUND`.
4. Authorize caller:
   - allow if `bookings.client_id == auth.userId`, OR
   - allow if caller is an assigned companion for the booking.
5. If not authorized: return 403 `FORBIDDEN`.
6. Validate booking status is one of: `ACTIVE`, `COMPLETED`, `CANCELLED`; else 400 `INVALID_STATE_TRANSITION`.
7. Derive `myDesignation`:
   - if caller is the booking owner client: `myDesignation = null`
   - if caller is a companion: read `booking_companion_assignments.designation` for `(booking_id, companion_id=auth.userId)`
8. Return session metadata mapping:
   - `startAt` ← `bookings.start_at`
   - `endAt` ← `bookings.end_at`
   - `extendedAt` ← `bookings.extended_at`
   - `nearEndNotifiedAt` ← `bookings.near_end_notified_at`

E. Scheduler: session-auto-end
- Trigger: `endAt <= now` on `ACTIVE` bookings.
- Behavior: end the booking atomically by transitioning `ACTIVE → COMPLETED`.
- Exactly-once / idempotency guard (MUST be used):
  1) Select eligible bookings (batching is implementation-defined): `status='ACTIVE' AND end_at <= now()`.
  2) For each booking id, perform a transaction that:
     - locks the booking row (`SELECT ... FOR UPDATE`),
     - re-checks eligibility under lock,
     - updates status with a conditional update (only if still `ACTIVE` and `end_at <= now()`),
     - commits.
  3) If the booking is already `CANCELLED` or `COMPLETED`, the scheduler must no-op.

F. Scheduler: near-end-notification
- Trigger: `endAt - now <= 15 minutes`, `near_end_notified_at is null`, booking is `ACTIVE`.
- Exactly-once / idempotency guard (MUST be used):
  1) Perform a conditional UPDATE that sets `near_end_notified_at = now()` ONLY when all conditions still hold:
     - `status='ACTIVE'`
     - `near_end_notified_at IS NULL`
     - `end_at - now() <= interval '15 minutes'`
  2) Send push + in-app notifications ONLY if the UPDATE affected exactly 1 row.
  3) If the UPDATE affected 0 rows: do nothing (another worker already notified, booking ended/cancelled, or time window no longer valid).
  4) Retry guidance: if notification send fails AFTER the UPDATE commits, do NOT automatically resend unless a separate outbox/dispatch mechanism is implemented (out of scope for this SDS).
- Notification interaction semantics (client-side): tapping "Yes" triggers `PATCH /bookings/{id}/extend`; tapping "No" is a no-op.

G. Scheduler: companion-300m-breach-check
- Runs continuously (~60s cadence).
- For each active booking, read last GPS for each companion and compute haversine distance vs venue.
- If distance > 300m:
  - Record breach (no DB schema in this scope): emit a structured audit log event `BOOKING_COMPANION_VENUE_BREACH` with fields: bookingId, companionUserId, venueId, distanceMeters, companionLat, companionLng, venueLat, venueLng, occurredAt.
  - Alert admin.
  - Notification policy (v1.0.0): no deduplication/cooldown is specified; alerts and pushes may repeat on each ~60s run while the breach persists.
  - Send push notification to that companion.
  - Client is NOT notified.
- If no GPS, skip.

9. State Changes

- Extend: updates booking endAt (+1h) and sets extendedAt.
- SOS: none (stub; no writes).
- Messages: append/read booking message records.
- session-auto-end: `ACTIVE → COMPLETED`.
- near-end-notification: sets `near_end_notified_at`.

10. DB Operations

- Extend: lock booking row; update end_at + extended_at.
- Messages: read/write booking message rows.
- SOS: none (stub; no DB writes).
- Schedulers:
  - auto-end: lock + update booking status to COMPLETED.
  - near-end: conditional UPDATE setting `near_end_notified_at` only when NULL + send-only-if-updated (exactly-once guard).

11. Transaction Boundaries

- Extend: single DB transaction.
- session-auto-end: atomic per booking.
- near-end-notification: the conditional UPDATE (set `near_end_notified_at` only if NULL + within 15 minutes + status ACTIVE) must be atomic with the send decision:
  - send notifications ONLY if UPDATE affected exactly 1 row
  - if UPDATE affected 0 rows: do not send
  - if send fails after UPDATE commits: do NOT resend automatically (outbox pattern is out of scope)

12. Constraints

- Timer: countdown derived from `endAt - now`.
- Extension: +1 hour fixed; extend at most once.
- Chat: Captain↔Vice only via HTTP polling.
- Chat polling cadence: 3–5 seconds.
- Transport constraint: HTTP polling only (no WebSocket/SSE).
- 300m breach: venue-based distance threshold of 300m.
- Client not notified for breach alerts.

13. Concurrency Rules

- Extend vs auto-end and cancel must lock booking row; operations must re-check state under lock.
- Messages allow concurrent inserts; ordering by `(createdAt, id)` (createdAt primary; id tie-breaker).

14. Failure Cases

- extend: 401, 403, 404, 400 invalid state (not ACTIVE / already extended)
- sos: 401, 403, 404, 400 invalid state (not ACTIVE)
- messages: 401, 403, 404, 400 invalid state, 400 validation error
- session: 401, 403, 404, 400 invalid state (status not in ACTIVE/COMPLETED/CANCELLED)

15. Side Effects

- near-end-notification: push + in-app
- sos: none (stub; no admin alert / notifications)
- breach: structured audit log (BOOKING_COMPANION_VENUE_BREACH) + alert admin + push companion

16. Idempotency Rules

- extend: not idempotent; second call fails.
- sos: idempotent (no side effects); safe to retry.
- messages POST: not idempotent.
- GET messages: idempotent.
- near-end-notification (scheduler): idempotent/exactly-once best-effort via conditional UPDATE + send-only-if-updated guard.
- companion-300m-breach-check (scheduler): not idempotent; may emit repeated audit logs/alerts/pushes while breach persists (no dedupe specified in v1.0.0).
