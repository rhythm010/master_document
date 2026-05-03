Feature: Ratings
Version: 1.0.0
Status: Current
Previous Version: None (net-new)
Change Type: MAJOR
Change Summary: Net-new Feature SDS for client + companion rating flows; validation uses 400; CANCELLED guard; retry-safe duplicate handling.
Created At: 2026-05-03T15:43:46Z
Last Edited At: 2026-05-03T16:34:29Z
Owner: Ratings Module

Module: Ratings

1. Purpose

Define the end-of-session rating experience for both:
- Client rating the companion duo (single overall rating; optional stars; tags required)
- Companion (Captain and Vice Captain) rating the client independently (stars required; tags required)

This SDS covers:
- rating page behaviors (submit vs skip rules)
- API contract for rating submission
- tag architecture (open-set tags; grouping managed via app config)
- DB/schema constraints for booking_ratings to support nullable stars (client-only) and comment length limit
- alignment with Core SDS invariants (immutability)

Source / Alignment
- Master documents:
  - `master-document/1.6_End_Session_Flow.md`
  - `master-document/1.5_Session_In_Progress_Flow.md`
- Core SDS: `SDS/core_sds.md` (BookingRating entity + invariant: BookingRatings immutable once created)
- Schema: `SDS/data-model/schema.md` (booking_ratings table; booking_rating_type enum)
- Approved clarity artifact: `SDS/artifacts/TASK-20260503-002-clarity.json`

2. API Contract

A. `POST /bookings/{id}/rating`
Creates a new immutable BookingRating record for the authenticated caller (client or assigned companion).

Notes:
- This endpoint is used by both client and companions.
- `ratingType` is determined by caller role:
  - CLIENT → `CLIENT_RATING_DUO`
  - COMPANION → `COMPANION_RATING_CLIENT`
- Tags are an open set: the server MUST NOT validate tag values against an enum; only structural validation applies (array length, string type).
- `comment` is optional at the API level, but is stored in DB as a non-null string:
  - if omitted (or sent as null), the server MUST store `comment = ''` (empty string)
- Retry/idempotency behavior:
  - If the same caller retries and hits the unique constraint on `(booking_id, rating_type, rater_user_id)`, the server returns **200 OK** with the **existing** rating payload (no update; BookingRatings are immutable).

3. Input

A. `POST /bookings/{id}/rating`

Headers:
- `Authorization: Bearer <token>`

Path params:
- `id`: uuid (required) — booking id

Body (JSON):
- `stars`: integer 1–5 OR null (rules depend on caller; see validations)
- `tags`: string[] (required) — MUST contain at least 1 element
- `comment`: string (optional) — max 300 characters
  - Storage rule: if omitted (or null), server stores `''` (empty string)

Caller-dependent payload rules:
- Client flow (`CLIENT_RATING_DUO`):
  - `stars` is OPTIONAL and may be omitted or explicitly null
- Companion flow (`COMPANION_RATING_CLIENT`):
  - `stars` is REQUIRED and MUST be an integer 1–5 (must not be null)

Validation rules (server-side):
- booking must exist
- booking.status must be:
  - `COMPLETED`, OR
  - `CANCELLED` AND `bookings.start_at <= now()` (guard for cancel-from-ACTIVE eligibility)
- caller must be authorized (client owner OR assigned companion)
- `tags.length >= 1`
- `stars`:
  - if provided (non-null): must be between 1 and 5 inclusive
  - if caller is COMPANION: must be non-null
- `comment`:
  - server normalizes `commentNormalized = (comment ?? '')`
  - must satisfy `length(commentNormalized) <= 300`

4. Output

A. `POST /bookings/{id}/rating` (201 Created)
Returns the created rating record.

B. `POST /bookings/{id}/rating` (200 OK — duplicate/retry-safe)
Returns the existing rating record when the request would violate the unique constraint on `(booking_id, rating_type, rater_user_id)`.

Note:
- Response `comment` is always a string (because DB storage is NOT NULL); when omitted in request it will be returned as `""`.
- On 200 OK duplicate/retry responses, the returned payload reflects the originally created immutable rating record.

Example (client submission with nullable stars):
```json
{
  "id": "uuid",
  "bookingId": "uuid",
  "raterUserId": "uuid",
  "ratingType": "CLIENT_RATING_DUO",
  "stars": null,
  "tags": ["Professional", "Punctual"],
  "comment": "",
  "createdAt": "ISO-8601"
}
```

Example (companion submission with required stars):
```json
{
  "id": "uuid",
  "bookingId": "uuid",
  "raterUserId": "uuid",
  "ratingType": "COMPANION_RATING_CLIENT",
  "stars": 5,
  "tags": ["Attentive"],
  "comment": "",
  "createdAt": "ISO-8601"
}
```

Error envelope (per Core SDS):
```json
{ "code": "string", "message": "string" }
```

5. Authorization Rules

- Requires Bearer token.
- Allowed callers:
  - Client who owns the booking (`bookings.client_id == auth.userId`)
  - Companion assigned to the booking (exists in `booking_companion_assignments` for booking_id with `companion_id == auth.userId`)
- Not allowed:
  - Any non-participant user
  - Any companion not assigned to the booking

6. Preconditions

For `POST /bookings/{id}/rating`:
- Authenticated user exists.
- Booking exists.
- Booking status eligibility is:
  - `COMPLETED`, OR
  - `CANCELLED` AND `bookings.start_at <= now()`
- Caller is:
  - the booking owner client, OR
  - an assigned companion of the booking
- Request validation passes:
  - tags length >= 1
  - comment length <= 300 (after normalization of omitted/null to empty string)
  - stars rules satisfied (caller-dependent)
- Duplicate submission handling:
  - only one row may exist per (booking_id, rating_type, rater_user_id) (enforced by unique constraint)
  - duplicate/retry submissions MUST return 200 OK with the existing rating payload (no update)

7. Data Access Mapping

Tables used:
- `bookings`
  - `id`, `client_id`, `status`, `start_at`
- `booking_companion_assignments`
  - `booking_id`, `companion_id`, `designation`
- `booking_ratings`
  - `id`, `booking_id`, `rater_user_id`, `rating_type`, `stars`, `tags`, `comment`, `created_at`
- `companion_profiles`
  - `user_id`, `average_rating` (updated only after client duo ratings with non-null stars)

8. Business Logic

8.A Client Rating Flow (CLIENT_RATING_DUO)

Trigger:
- Rating page shown to client immediately after:
  - booking transitions `ACTIVE → COMPLETED`, OR
  - client cancels from `ACTIVE` and booking becomes `CANCELLED`
- Eligibility clarification:
  - Rating on `CANCELLED` is only intended for cancel-from-`ACTIVE` scenarios; server enforces eligibility for `CANCELLED` via guard `bookings.start_at <= now()`.

Client UI requirements (single screen / duo context):
- Show BOTH companions (Captain + Vice Captain): photo + name.
- Stars selector (1–5):
  - optional; client may submit without stars selected
  - if not selected, stars is stored as NULL
- Tags:
  - Two sections:
    - Positive label: “What did you appreciate the most?”
      - Starting set:
        - Professional
        - Charismatic
        - Punctual
        - Excellent Conversation
        - Attentive
        - Elegant
    - Negative label: “What could have been better?”
      - Starting set: **PLACEHOLDER / TBD**
      - NOTE: This negative tag starting list MUST be defined before frontend implementation.
  - Tag selection is multi-select in both sections.
  - Minimum requirement: at least 1 tag total selected across both sections combined.
- Comment:
  - Optional free-text
  - Label: “OVERALL SERVICE”
  - Max length: 300 characters
  - Storage: if omitted (or null), server stores empty string `''` in DB.
- X (skip) behavior:
  - X is disabled / non-functional until at least 1 tag is selected.
  - Once at least 1 tag is selected, X is available.
  - Tapping X skips submission entirely:
    - NO API call
    - client is redirected to home
- Submit behavior:
  - Submit is only available once at least 1 tag is selected (same gating as X).
  - On submit:
    - client calls `POST /bookings/{id}/rating` with:
      - stars: nullable
      - tags: array length >= 1
      - comment: optional max 300
    - on success: redirect client to home

8.B Companion Rating Flow (COMPANION_RATING_CLIENT)

Trigger:
- Rating page shown to each companion (Captain and Vice Captain) immediately after:
  - booking transitions `ACTIVE → COMPLETED`, OR
  - client cancels from `ACTIVE` and booking becomes `CANCELLED`
- Eligibility clarification:
  - Rating on `CANCELLED` is only intended for cancel-from-`ACTIVE` scenarios; server enforces eligibility for `CANCELLED` via guard `bookings.start_at <= now()`.

Companion rules:
- Each companion submits independently (each is a separate rater_user_id).
- Stars:
  - mandatory for companions
  - companion cannot submit without selecting stars
- Tags and comment:
  - same structure as client:
    - positive tags section
    - negative tags section (PLACEHOLDER / TBD starting list)
    - optional comment (<= 300)
  - same min-1-tag rule applies
- No skipping:
  - No X button for companions

On submit:
- companion calls `POST /bookings/{id}/rating`
- server stores `ratingType = COMPANION_RATING_CLIENT`
- on success: redirect companion to home

8.C Server-Side Rating Submission Logic (shared endpoint)

Given: authenticated caller, bookingId, request payload

1) Load booking by id
   - if not found → 404 BOOKING_NOT_FOUND
2) Validate booking status eligibility
   - if status == COMPLETED → ok
   - else if status == CANCELLED:
     - require `bookings.start_at <= now()` → else 400 INVALID_STATE_TRANSITION
   - else → 400 INVALID_STATE_TRANSITION
3) Determine caller role and authorization
   - if CLIENT:
     - require booking.client_id == auth.userId
     - set ratingType = CLIENT_RATING_DUO
   - if COMPANION:
     - require exists booking_companion_assignments row for (booking_id, companion_id=auth.userId)
     - set ratingType = COMPANION_RATING_CLIENT
   - else → 403 FORBIDDEN
4) Validate payload
   - tags.length >= 1 → else 400 VALIDATION_ERROR
   - comment:
     - normalize: `commentNormalized = (comment ?? '')`
     - commentNormalized length <= 300 → else 400 VALIDATION_ERROR
   - stars:
     - if null/omitted:
       - allowed only when caller role is CLIENT
       - if caller role is COMPANION → 400 VALIDATION_ERROR
     - if provided (non-null): must be integer 1..5 → else 400 VALIDATION_ERROR
5) Insert booking_ratings row
   - must be immutable: no updates after creation
   - store `comment = commentNormalized` (never NULL)
   - unique constraint enforces one row for (booking_id, rating_type, rater_user_id)
     - on unique violation:
       - fetch the existing booking_ratings row for (booking_id, rating_type, rater_user_id)
       - return 200 OK with the existing rating payload
       - do NOT update average_rating (no new rating was created)
6) Side effect: update companion_profiles.average_rating (client ratings only, stars non-null only)
   - Attribution semantics (duo-level model; explicit):
     - Each `CLIENT_RATING_DUO` row with non-null `stars` counts toward BOTH companions assigned to that booking.
     - Because `booking_ratings` has no `companion_id`, attribution is derived by joining through booking assignments.
   - If ratingType == CLIENT_RATING_DUO AND stars is non-null:
     - Identify the two companions assigned to bookingId via `booking_companion_assignments`.
     - Recompute each companion’s average as:
       - AVG(br.stars) across all `booking_ratings br` where:
         - br.rating_type = 'CLIENT_RATING_DUO'
         - br.stars IS NOT NULL
         - AND br.booking_id is a booking where that companion appears in `booking_companion_assignments`
     - Persist the recomputed value into `companion_profiles.average_rating`.
   - If stars is null → do not update average_rating

9. State Changes

- Booking state:
  - No booking state transitions occur during rating submission (booking is already COMPLETED or eligible CANCELLED when rating page is shown).
- BookingRating:
  - New immutable booking_ratings row is created on successful submission.
  - On duplicate/retry submissions, no new row is created; the existing row is returned.
- CompanionProfile:
  - `companion_profiles.average_rating` is recalculated/updated after each successful CLIENT_RATING_DUO submission with non-null stars.

10. DB Operations

10.A Core operations (per request)

Read:
- `SELECT id, client_id, status, start_at FROM bookings WHERE id = :bookingId;`
- If COMPANION caller:
  - `SELECT 1 FROM booking_companion_assignments WHERE booking_id = :bookingId AND companion_id = :authUserId;`

Insert:
- `INSERT INTO booking_ratings (id, booking_id, rater_user_id, rating_type, stars, tags, comment) VALUES (...);`
  - `comment` MUST be a non-null string; if omitted/null in request, insert `''`.

Duplicate handling (retry-safe):
- On unique constraint violation for `(booking_id, rating_type, rater_user_id)`:
  - `SELECT id, booking_id, rater_user_id, rating_type, stars, tags, comment, created_at FROM booking_ratings WHERE booking_id = :bookingId AND rating_type = :ratingType AND rater_user_id = :authUserId;`
  - return 200 OK with the selected row

Average rating update (client submission with non-null stars):
- Identify assigned companions for booking:
  - `SELECT companion_id FROM booking_companion_assignments WHERE booking_id = :bookingId;`

- Concurrency-safe recomputation sketch (performed inside the same transaction as the insert):
  1) Fetch the two companions (for the booking being rated):
     ```sql
     SELECT companion_id
     FROM booking_companion_assignments
     WHERE booking_id = :bookingId;
     ```

  2) Lock the corresponding `companion_profiles` rows to serialize recomputation and avoid lost updates:
     ```sql
     SELECT user_id
     FROM companion_profiles
     WHERE user_id IN (:companionId1, :companionId2)
     ORDER BY user_id
     FOR UPDATE;
     ```

  3) Recompute and write `average_rating` for the two companions using the join path:
     - `booking_ratings.booking_id -> booking_companion_assignments.booking_id (all bookings for companion)`
     ```sql
     UPDATE companion_profiles cp
     SET average_rating = COALESCE((
       SELECT AVG(br.stars)::numeric(3,2)
       FROM booking_companion_assignments bca
       JOIN booking_ratings br
         ON br.booking_id = bca.booking_id
       WHERE bca.companion_id = cp.user_id
         AND br.rating_type = 'CLIENT_RATING_DUO'
         AND br.stars IS NOT NULL
     ), 0.00)
     WHERE cp.user_id IN (:companionId1, :companionId2);
     ```

10.B Required schema changes (documented)

Constraints from request / clarity artifact:
- booking_rating_type enum: NO CHANGES (must remain as-is)
- booking_ratings are immutable: NO UPDATE/DELETE endpoints; insert-only behavior

Schema adjustments required:
1) booking_ratings.stars nullable + conditional CHECK
- Change:
  - `stars` from `smallint NOT NULL` → `smallint NULL`
  - CHECK must apply only when stars is not null
Example migration intent:
```sql
ALTER TABLE booking_ratings
  ALTER COLUMN stars DROP NOT NULL;

ALTER TABLE booking_ratings
  DROP CONSTRAINT chk_booking_ratings_stars;

ALTER TABLE booking_ratings
  ADD CONSTRAINT chk_booking_ratings_stars
  CHECK (stars IS NULL OR (stars BETWEEN 1 AND 5));
```

2) booking_ratings.comment max length 300 (NO nullability change)
- `comment` remains `text NOT NULL DEFAULT ''` per schema.
- Example constraint:
```sql
ALTER TABLE booking_ratings
  ADD CONSTRAINT chk_booking_ratings_comment_length
  CHECK (char_length(comment) <= 300);
```

Notes:
- No structural change required for `tags` storage: continue using `text[]` open set.
- Application must enforce: `array_length(tags, 1) >= 1` (do not rely on DB default '{}' for validity).

11. Transaction Boundaries

`POST /bookings/{id}/rating` MUST be executed atomically:
- Validate booking status eligibility + authorization
- Attempt insert booking_ratings row
  - If insert succeeds:
    - If applicable (CLIENT_RATING_DUO with stars non-null), update companion_profiles.average_rating for the two assigned companions (with concurrency-safe locking as described)
  - If insert fails due to unique constraint:
    - Fetch existing rating row and return 200 OK (no side effects)
- If any step fails (other than handled unique violation), the transaction must roll back and the rating must not be partially created.

12. Constraints

- Immutability (Core SDS invariant):
  - BookingRatings are immutable once created.
  - No update/delete operations are defined for BookingRating in this scope.
- Enum constraint:
  - booking_rating_type enum MUST NOT change in this scope.
  - Supported values used here:
    - CLIENT_RATING_DUO
    - COMPANION_RATING_CLIENT
- One submission constraint:
  - One row per booking per ratingType per rater is enforced by unique constraint:
    - `(booking_id, rating_type, rater_user_id)`
  - Duplicate/retry submissions return the existing row (200 OK) and do not create a second row.
- Stars constraints:
  - DB must allow NULL stars to support client optional stars.
  - Application must enforce:
    - COMPANION callers must provide non-null stars.
    - stars values, when present, must be 1..5.
- Tags constraints:
  - Tags stored as `text[]` open set (no server-side enum validation of tag strings).
  - Application must enforce `tags.length >= 1`.
  - Positive vs negative grouping is managed in app config/content layer (not DB).
- Comment constraints:
  - comment is optional at API level
  - storage is non-null: omitted/null is stored as `''`
  - length <= 300 enforced (DB CHECK and/or application validation)

13. Concurrency Rules

- Duplicate submissions / retries:
  - Concurrent requests from the same rater for the same booking + ratingType will race on the unique constraint.
  - Exactly one insert may succeed; all others MUST be handled by:
    - catching the unique constraint violation
    - fetching the existing rating row
    - returning 200 OK with the existing rating payload
- average_rating recomputation:
  - Recalculation occurs only after a successful insert for client duo ratings with non-null stars.
  - Attribution is duo-level: each client duo rating contributes to both companions assigned to that booking.
  - To prevent lost updates under concurrency, recomputation MUST be serialized per companion:
    - lock the two affected `companion_profiles` rows (`FOR UPDATE`) within the same transaction before writing updated averages.

14. Failure Cases

- 401 UNAUTHORIZED
  - Missing/invalid Bearer token
- 403 FORBIDDEN
  - Caller is not the booking owner client and not an assigned companion
- 404 BOOKING_NOT_FOUND
  - Booking does not exist
- 400 INVALID_STATE_TRANSITION
  - Booking status is not eligible:
    - not COMPLETED, and not (CANCELLED AND bookings.start_at <= now())
- 400 VALIDATION_ERROR
  - tags length < 1
  - comment length > 300
  - stars out of range (when provided)
  - companion caller with stars null/omitted
- 500 INTERNAL_SERVER_ERROR
  - Unexpected DB or server error (including unexpected inability to load existing row after a unique constraint violation)

15. Side Effects

- After successful client submission with non-null stars:
  - update `companion_profiles.average_rating` for the two companions assigned to the booking (AVG of non-null CLIENT_RATING_DUO stars attributed via booking assignments)
- Client navigation side effects (client-side behavior):
  - After successful submit: redirect to home
  - After skip (X): redirect to home with no API call
- Companion navigation side effects (client-side behavior):
  - After successful submit: redirect to home

16. Idempotency Rules

- No idempotency key header is used in this scope.
- The endpoint is **retry-safe** for duplicate submissions by the same rater for the same booking and inferred ratingType:
  - Uniqueness is enforced by `(booking_id, rating_type, rater_user_id)`.
  - On duplicate (unique constraint violation), the server MUST return **200 OK** with the **existing** immutable rating payload.
- If a retried request’s body differs from the original request:
  - The server still returns the existing immutable rating (no updates are allowed).
