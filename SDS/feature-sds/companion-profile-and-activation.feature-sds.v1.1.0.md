Feature: Companion Profile & Activation
Version: 1.1.0
Status: Archived
Previous Version: companion-profile-and-activation.feature-sds.v1.0.0.md
Change Type: MINOR
Change Summary: Add public/non-PII companion profile read-by-id endpoint (GET /companion-profiles/{companionId}) for any authenticated user; update scope notes to include client viewing.
Created At: 2026-04-29T15:16:52Z
Last Edited At: 2026-04-29T15:16:52Z
Owner: Companion Profile & Activation Module

Feature: Companion Profile & Activation
Module: Companion Profile & Activation

1. Purpose

Provide companion profile read/update (languages, sketch profile picture), `isActive` toggle behavior (ON by default; OFF blocks matching initiation), and performance rating surface via `averageRating`.

Scope Notes:
- Companion display name (nickname) is managed by the Identity & Auth module (users.nickname) and is out of scope for this feature. Nickname editing is handled via a separate profile/settings endpoint in the Identity module.
- This module only manages companion-specific profile attributes: languages, profilePictureUrl, isActive, averageRating.
- Profile completion (languages, picture) is optional and can be done at any time via the profile settings page. Companions are not prompted to complete their profile during onboarding. Companions can be assigned to bookings with incomplete profiles (empty languages/picture defaults per schema).
- Client/any-user viewing of companion public profiles is **IN SCOPE** via `GET /companion-profiles/{companionId}` (public, non-PII). Booking Details also exposes the same public companion info to the booking owner client.

Sources:
- `master-document/1.1_Onboarding_And_Profile.md` (Active toggle, home page performance section, profile editing)
- `master-document/1.3_Booking_Confirmation_Page.md` (client-side booking details display includes languages, profile picture, ratings)

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

E. `GET /companion-profiles/{companionId}`
Returns a companion's **public, non-PII** profile fields for display purposes. Callable by any authenticated user (CLIENT or COMPANION).

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

E. `GET /companion-profiles/{companionId}`
- Path param: `{companionId}` (uuid) — companion user id (`users.id`)
- No body. Uses `Authorization: Bearer <token>`.

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

E. `GET /companion-profiles/{companionId}` (200)
```json
{
  "id": "uuid",
  "displayName": "string",
  "designation": "CAPTAIN" | "VICE_CAPTAIN",
  "languages": ["ENGLISH", "ARABIC"],
  "profilePictureUrl": "string",
  "averageRating": 4.25
}
```

Privacy rules:
- Response MUST NOT include PII fields such as `users.name`, `users.email`, `users.password_hash`, phone, or any location data.
- Response is explicitly defined as public/non-PII and safe to show to any authenticated user.

Error envelope (per Core SDS):
```json
{ "code": "string", "message": "string" }
```

5. Authorization Rules

- All endpoints require Bearer token authentication.
- Companion-only endpoints (require `role=COMPANION`):
  - `GET /companion-profiles/me`
  - `POST /companion-profiles/upload-picture`
  - `PATCH /companion-profiles/me`
  - `PATCH /companion-profiles/toggle-active`
  - A companion may only read/update their own profile (`/me`).
- Public read endpoint (any authenticated user):
  - `GET /companion-profiles/{companionId}` (CLIENT or COMPANION)

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

E. `GET /companion-profiles/{companionId}`
- Authenticated user exists (CLIENT or COMPANION).
- `{companionId}` is a valid uuid.
- A `users` row exists for `{companionId}` AND a `companion_profiles` row exists for `companion_profiles.user_id == {companionId}`; otherwise 404 `COMPANION_PROFILE_NOT_FOUND`.

7. Data Access Mapping

- `users`
  - `id` ↔ companion.id
  - `nickname` ↔ companion.displayName (public non-PII)

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
3. Validate uploaded file (type/size).
4. Upload file to storage and return URL.
5. Note: This endpoint does NOT update companion_profiles table.

C. `PATCH /companion-profiles/me`
1. Authenticate request.
2. If `role != COMPANION`: return 403 `FORBIDDEN`.
3. Validate request contains at least one supported field.
4. Validate languages + normalize profilePictureUrl.
5. Update row in `companion_profiles`.
6. Return updated profile.

D. `PATCH /companion-profiles/toggle-active`
1. Authenticate request.
2. If `role != COMPANION`: return 403 `FORBIDDEN`.
3. Validate `isActive` is boolean.
4. Update `companion_profiles.is_active`.
5. Return updated profile.

E. `GET /companion-profiles/{companionId}`
1. Authenticate request.
2. Validate `{companionId}` is a uuid.
3. Fetch companion public profile by id (join `users` + `companion_profiles`).
4. If not found: return 404 `COMPANION_PROFILE_NOT_FOUND`.
5. Return public fields only: `id`, `displayName`, `designation`, `languages`, `profilePictureUrl`, `averageRating`.

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

E. `GET /companion-profiles/{companionId}`
- `SELECT u.id, u.nickname, cp.designation, cp.languages, cp.profile_picture_url, cp.average_rating
   FROM users u
   JOIN companion_profiles cp ON cp.user_id = u.id
   WHERE u.id = $1`

11. Transaction Boundaries

- GETs: no transaction required.
- PATCH/UPDATE: single-row updates; execute atomically.

12. Constraints

- `companion_profiles.user_id` is unique and references `users.id`.
- `is_active` default is `true`.
- Public endpoint MUST NOT return PII.

13. Concurrency Rules

- Updates are last-write-wins.

14. Failure Cases

Error response precedence order: 401 → 403 → 404 → 400 → 500

- `GET /companion-profiles/{companionId}`
  - 401 `UNAUTHORIZED`
  - 404 `COMPANION_PROFILE_NOT_FOUND`
  - 500 `INTERNAL_ERROR`

15. Side Effects

- None.

16. Idempotency Rules

- `GET /companion-profiles/me`: idempotent.
- `GET /companion-profiles/{companionId}`: idempotent.
- `POST /companion-profiles/upload-picture`: not idempotent.
- `PATCH /companion-profiles/me`: idempotent for identical payload.
- `PATCH /companion-profiles/toggle-active`: idempotent for identical `isActive` value.

17. Cross-Module Integration

A. Ratings & Performance Engine:
- Updates `companion_profiles.average_rating` after ratings submission.

B. Booking Details (Client Booking Details):
- Companion profile data is exposed to the booking owner client via `GET /bookings/{id}/details` (no timing-based reveal).
- This module ALSO provides a direct public/non-PII read endpoint `GET /companion-profiles/{companionId}` for any authenticated user.

C. Matching & Activation:
- Arrival confirmation enforces `companion_profiles.is_active=true`.
