Feature: Companion Profile & Activation
Module: Companion Profile & Activation

1. Purpose

Provide companion profile read/update (languages, sketch profile picture), `isActive` toggle behavior (ON by default; OFF blocks matching initiation), and performance rating surface via `averageRating`.

Scope Notes:
- Companion display name (nickname) is managed by the Identity & Auth module (users.nickname) and is out of scope for this feature. Nickname editing is handled via a separate profile/settings endpoint in the Identity module.
- This module only manages companion-specific profile attributes: languages, profilePictureUrl, isActive, averageRating.
- Profile completion (languages, picture) is optional and can be done at any time via the profile settings page. Companions are not prompted to complete their profile during onboarding. Companions can be assigned to bookings with incomplete profiles (empty languages/picture defaults per schema).
- Client viewing of companion profiles is out of scope for this feature. Companion profile data is exposed to clients via the Booking Details & Timed Reveal feature module.

Sources:
- `master-document/1.1_Onboarding_And_Profile.md` (Active toggle, home page performance section, profile editing)
- `master-document/1.3_Booking_Confirmation_Page.md` (client-side reveal includes languages, sketch profile picture, ratings)

Alignment:
- `SDS/core_sds.md` invariants:
  - `CompanionProfile.isActive` is ON by default
  - A companion may only transition presenceStatus to ARRIVED if `CompanionProfile.isActive` is true
- `SDS/data-model/schema.md` tables: `companion_profiles`, `users`, and rating-derived updates to `companion_profiles.average_rating`

2. API Contract

A. `GET /companion-profiles/me`
Returns the authenticated companion's profile data used by the companion home page and downstream modules.

B. `POST /companion-profiles/upload-picture`
Uploads a profile picture image file and returns the stored URL.

C. `PATCH /companion-profiles/me`
Updates editable companion profile fields:
- `languages`
- `profilePictureUrl` (sketch profile picture URL)

Partial update: only provided fields are updated; unprovided fields retain their existing values.

D. `PATCH /companion-profiles/toggle-active`
Sets the companion's `isActive` flag.

3. Input

A. `GET /companion-profiles/me`
- No body. Uses `Authorization: Bearer <token>`.

B. `POST /companion-profiles/upload-picture` (multipart/form-data)
- `picture`: File (required)
  - Accepted formats: JPEG, PNG
  - Max file size: 5MB
  - Field name: `picture`

C. `PATCH /companion-profiles/me` (JSON)
- `languages`: string[] (optional)
  - Must be from predefined list: ["ENGLISH", "ARABIC"]
  - Max 10 languages per profile
  - Empty array allowed
- `profilePictureUrl`: string (optional)
  - URL returned from upload-picture endpoint or empty string to remove picture

At least one of `languages` or `profilePictureUrl` must be provided.

D. `PATCH /companion-profiles/toggle-active` (JSON)
- `isActive`: boolean (required)

4. Output

A. `GET /companion-profiles/me` (200)
```json
{
  "id": "uuid",
  "userId": "uuid",
  "designation": "CAPTAIN",
  "isActive": true,
  "languages": ["ENGLISH", "ARABIC"],
  "profilePictureUrl": "string",
  "averageRating": 4.25
}
```

B. `POST /companion-profiles/upload-picture` (200)
```json
{
  "profilePictureUrl": "https://storage.companion.app/profiles/{userId}/picture.jpg"
}
```

C. `PATCH /companion-profiles/me` (200)
```json
{
  "id": "uuid",
  "userId": "uuid",
  "designation": "CAPTAIN",
  "isActive": true,
  "languages": ["ENGLISH"],
  "profilePictureUrl": "string",
  "averageRating": 4.25
}
```

D. `PATCH /companion-profiles/toggle-active` (200)
```json
{
  "id": "uuid",
  "userId": "uuid",
  "designation": "CAPTAIN",
  "isActive": false,
  "languages": ["ENGLISH", "ARABIC"],
  "profilePictureUrl": "string",
  "averageRating": 4.25
}
```

Error envelope (per Core SDS):
```json
{ "code": "string", "message": "string" }
```

5. Authorization Rules

- All endpoints require Bearer token authentication.
- Only users with `role=COMPANION` may access these endpoints.
- A companion may only read/update their own profile (`/me`).

6. Preconditions

A. `GET /companion-profiles/me`
- Authenticated user exists.
- Authenticated user `role == COMPANION`.
- A `companion_profiles` row exists for `companion_profiles.user_id == users.id`.

B. `POST /companion-profiles/upload-picture`
- Authenticated user exists.
- Authenticated user `role == COMPANION`.
- Uploaded file must be valid image (JPEG or PNG).
- File size must not exceed 5MB.

C. `PATCH /companion-profiles/me`
- Authenticated user exists.
- Authenticated user `role == COMPANION`.
- A `companion_profiles` row exists for `companion_profiles.user_id == users.id`.
- If `languages` provided: each language must be in ["ENGLISH", "ARABIC"].
- If `languages` provided: array length must not exceed 10.

D. `PATCH /companion-profiles/toggle-active`
- Authenticated user exists.
- Authenticated user `role == COMPANION`.
- A `companion_profiles` row exists for `companion_profiles.user_id == users.id`.

7. Data Access Mapping

- `companion_profiles`
  - `id` ↔ companionProfile.id
  - `user_id` ↔ companionProfile.userId
  - `designation` ↔ companionProfile.designation
  - `is_active` ↔ companionProfile.isActive
  - `languages` ↔ companionProfile.languages
  - `profile_picture_url` ↔ companionProfile.profilePictureUrl
  - `average_rating` ↔ companionProfile.averageRating (numeric type, formatted to 2 decimal places)

Notes:
- `averageRating` is not user-editable; it is updated by the Ratings & Performance Engine after ratings submission.
- `averageRating` is returned as JSON number type (not string), formatted to 2 decimal places.

8. Business Logic

A. `GET /companion-profiles/me`
1. Authenticate request.
2. If `role != COMPANION`: return 403 `FORBIDDEN` (check role before profile existence).
3. Fetch `companion_profiles` by `user_id = auth.userId`.
4. If not found: return 404 `COMPANION_PROFILE_NOT_FOUND`.
5. Return the profile fields.

B. `POST /companion-profiles/upload-picture`
1. Authenticate request.
2. If `role != COMPANION`: return 403 `FORBIDDEN`.
3. Validate uploaded file:
   - Check file is present in request.
   - Check MIME type is `image/jpeg` or `image/png`.
   - Check file size ≤ 5MB.
4. Generate unique filename: `{userId}/picture_{timestamp}.{ext}`.
5. Upload file to local storage directory: `uploads/profiles/{userId}/`.
6. Generate public URL: `http://{server}/uploads/profiles/{userId}/picture_{timestamp}.{ext}` (served via Express.static).
7. Return `{profilePictureUrl: generatedUrl}`.
8. Note: This endpoint does NOT update companion_profiles table. Companion must call PATCH /companion-profiles/me with the returned URL to save it to their profile.

C. `PATCH /companion-profiles/me`
1. Authenticate request.
2. If `role != COMPANION`: return 403 `FORBIDDEN`.
3. Validate request contains at least one supported field (`languages` and/or `profilePictureUrl`).
4. If `languages` present:
   - Validate it is an array.
   - Validate array length ≤ 10.
   - Validate each element is in ["ENGLISH", "ARABIC"] (case-sensitive).
   - Remove duplicates if any.
   - Empty array is allowed.
5. If `profilePictureUrl` present:
   - Validate it is a string.
   - Normalize by trimming whitespace.
   - Empty string is treated as no profile picture (valid; removes existing picture).
   - Null is not accepted (use empty string instead).
6. Update the authenticated companion's row in `companion_profiles`.
7. Return the updated profile.

D. `PATCH /companion-profiles/toggle-active`
1. Authenticate request.
2. If `role != COMPANION`: return 403 `FORBIDDEN`.
3. Validate `isActive` is boolean.
4. Update `companion_profiles.is_active` for `user_id = auth.userId`.
5. Return the updated profile.

Activation semantics (cross-module enforcement):
- When `isActive=false`, the "Reached location?" button is DISABLED in the companion home page UI (per master-document/1.1_Onboarding_And_Profile.md section 1.1.3.2).
- Enforcement is client-side UI control: companion app disables the button when companion profile isActive=false.
- Server-side enforcement exists in Matching module: the arrival confirmation API (presenceStatus transition to ARRIVED) checks companion_profiles.is_active=true and rejects the request if false.
- See Matching & Activation Feature SDS for server-side enforcement details.

`averageRating` update semantics (cross-module ownership):
- On creation of a `booking_ratings` record with `rating_type='CLIENT_RATING_DUO'`, the Ratings & Performance Engine updates `companion_profiles.average_rating` for both companions assigned to that booking.
- This module only surfaces `averageRating` via reads; it does not accept direct client/companion writes for this field.

9. State Changes

- CompanionProfile state (modeled as `is_active` boolean):
  - Default is ON (`true`) on profile creation.
  - Toggling updates `is_active`.

10. DB Operations

A. `GET /companion-profiles/me`
- `SELECT * FROM companion_profiles WHERE user_id = $1`

B. `POST /companion-profiles/upload-picture`
- No DB operations (file upload only)

C. `PATCH /companion-profiles/me`
- `UPDATE companion_profiles SET languages = COALESCE($2, languages), profile_picture_url = COALESCE($3, profile_picture_url)
   WHERE user_id = $1
   RETURNING *`

D. `PATCH /companion-profiles/toggle-active`
- `UPDATE companion_profiles SET is_active = $2 WHERE user_id = $1 RETURNING *`

11. Transaction Boundaries

- `GET /companion-profiles/me`: Single-row read. No transaction required.
- `POST /companion-profiles/upload-picture`: No DB transaction (file upload to storage only).
- `PATCH /companion-profiles/me`: Single-row update. Execute as one statement transactionally.
- `PATCH /companion-profiles/toggle-active`: Single-row update. Execute as one statement transactionally.

12. Constraints

- `companion_profiles.user_id` is unique and references `users.id` (schema constraint).
- `is_active` default is `true` (schema default).
- `average_rating` must be in the range 0.00–5.00 when written (enforced by the Ratings & Performance Engine).

13. Concurrency Rules

- Profile updates (`PATCH /companion-profiles/me`) are last-write-wins for any overlapping fields.
- Active toggle updates are last-write-wins.
- Matching initiation is guarded elsewhere by reading `is_active` at the point of arrival confirmation.

14. Failure Cases

Error response precedence order: 401 → 403 → 404 → 400 → 500

- `GET /companion-profiles/me`
  - 401 `UNAUTHORIZED` — missing/invalid token
  - 403 `FORBIDDEN` — authenticated user is not a companion
  - 404 `COMPANION_PROFILE_NOT_FOUND` — no profile row exists for the companion
  - 500 `INTERNAL_ERROR`

- `POST /companion-profiles/upload-picture`
  - 401 `UNAUTHORIZED` — missing/invalid token
  - 403 `FORBIDDEN` — authenticated user is not a companion
  - 400 `VALIDATION_ERROR` — missing file, invalid format, or file too large
  - 500 `INTERNAL_ERROR` — storage upload failure

- `PATCH /companion-profiles/me`
  - 401 `UNAUTHORIZED` — missing/invalid token
  - 403 `FORBIDDEN` — authenticated user is not a companion
  - 404 `COMPANION_PROFILE_NOT_FOUND` — no profile row exists
  - 400 `VALIDATION_ERROR` — invalid input types, empty update payload, invalid language code, or array too long
  - 400 `INVALID_LANGUAGE` — language not in [ENGLISH, ARABIC]
  - 500 `INTERNAL_ERROR`

- `PATCH /companion-profiles/toggle-active`
  - 401 `UNAUTHORIZED` — missing/invalid token
  - 403 `FORBIDDEN` — authenticated user is not a companion
  - 404 `COMPANION_PROFILE_NOT_FOUND` — no profile row exists
  - 400 `VALIDATION_ERROR` — isActive is not boolean
  - 500 `INTERNAL_ERROR`

15. Side Effects

- None.

16. Idempotency Rules

- `GET /companion-profiles/me`: idempotent.
- `POST /companion-profiles/upload-picture`: not idempotent; each call generates a new unique filename and URL.
- `PATCH /companion-profiles/me`: idempotent for identical payload.
- `PATCH /companion-profiles/toggle-active`: idempotent for identical `isActive` value.

17. Cross-Module Integration

A. Ratings & Performance Engine:
- The Ratings & Performance Engine updates `companion_profiles.average_rating` directly via database access (not API).
- Update trigger: When a `booking_ratings` record with `rating_type='CLIENT_RATING_DUO'` is created.
- Calculation: Simple arithmetic mean of all CLIENT_RATING_DUO stars for bookings where this companion was assigned.
- Formula: `average_rating = SUM(stars) / COUNT(*) for all CLIENT_RATING_DUO ratings targeting this companion`.
- This module is read-only for `averageRating`; companions cannot directly update it.
- See Ratings & Performance Engine Feature SDS for full calculation and update logic.

B. Booking Details & Timed Reveal:
- Companion profile data (languages, profilePictureUrl, averageRating, and nickname from users.nickname) is exposed to clients at T-5h via the Booking Details module.
- This module does NOT provide client-facing read endpoints.
- The Booking Details module reads companion_profiles and users tables directly or via internal service calls.

C. Matching & Activation:
- The `isActive` flag is checked by the Matching module during arrival confirmation.
- When companion attempts to confirm arrival (transition presenceStatus to ARRIVED), the Matching module validates `companion_profiles.is_active=true`.
- If `isActive=false`, the arrival confirmation API returns 403 `COMPANION_NOT_ACTIVE`.

18. Configuration

File Upload Storage:
- Storage provider: Local filesystem (Express.static) for Phase 1 per tech-stack.md
- Directory: `uploads/profiles/` (served via Express.static middleware)
- File path pattern: `uploads/profiles/{userId}/picture_{timestamp}.{ext}`
- Public read access: enabled (files served via /uploads route)
- Max file size: 5MB (5,242,880 bytes)
- Accepted MIME types: `image/jpeg`, `image/png`
- Storage lifecycle: No automatic deletion; old files remain accessible
- Phase 2 migration: Move to S3-compatible storage per tech-stack.md guidance

Language Validation:
- Supported languages: ["ENGLISH", "ARABIC"]
- Case-sensitive validation
- Displayed to users via dropdown/multi-select UI (not free-text input)

19. UI Integration

Profile Editing Access:
- Companions access profile editing via a Settings/Profile page (linked from home page menu/navigation).
- The home page displays read-only profile data: nickname (from users.nickname), average rating (from companion_profiles.average_rating).
- Full profile editing is available in a dedicated profile settings screen with sections:
  - Personal Info: Nickname (links to Identity module endpoint for editing users.nickname)
  - Companion Profile: Languages (multi-select dropdown), Profile Picture (upload button)
  - Account Status: Active toggle
- Changes to languages and profile picture are saved via this module's endpoints.
- Nickname changes are handled by the Identity & Auth module (separate endpoint, out of scope for this SDS).
