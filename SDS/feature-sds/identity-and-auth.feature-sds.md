Feature: Identity & Auth
Module: Identity & Auth

1. Purpose

Implement client/companion signup, email verification gating, and login/session issuance with:
- immutable `role` (CLIENT or COMPANION)
- password hashing (bcrypt)
- persisted `biometricAuthEnabled` preference
- email verification required before login succeeds
- resend verification email capability for recovery

Biometric Authentication (FaceID/TouchID): Device-only implementation. Client app stores credentials in iOS Keychain with biometric access control. On biometric success, client retrieves credentials and calls standard login endpoint. No server-side biometric endpoints required.

Out of Scope: Password reset/forgot password flow will be addressed in a separate feature if needed.

Source: `master-document/1.1_Onboarding_And_Profile.md`
Alignment: `SDS/core_sds.md` (User UNVERIFIED→VERIFIED), `SDS/data-model/schema.md` (`users` + `companion_profiles`)

2. API Contract

A. `POST /auth/signup`
Creates a new user (CLIENT or COMPANION), stores hashed password, sets `emailVerified=false`, sends verification email.

B. `GET /auth/verify-email?token={token}`
Verifies email using a signed verification token and sets `emailVerified=true`.

C. `POST /auth/resend-verification`
Resends verification email for unverified users (recovery mechanism for email send failures).

D. `POST /auth/login`
Authenticates via email+password, enforces `emailVerified=true`, returns JWT access token. Rate limited to prevent brute force attacks.

E. `GET /users/me`
Returns the authenticated user profile (and companion profile if role=COMPANION).

F. `PATCH /users/me`
Updates the authenticated user's nickname.

3. Input

A. `POST /auth/signup` (JSON)
- `role`: "CLIENT" | "COMPANION" (required)
- `name`: string (required)
- `nickname`: string (required)
- `email`: string (required)
- `password`: string (required)
- `biometricAuthEnabled`: boolean (optional; default false)

B. `GET /auth/verify-email`
- `token`: string (required, query param)

C. `POST /auth/resend-verification` (JSON)
- `email`: string (required)

D. `POST /auth/login` (JSON)
- `email`: string (required)
- `password`: string (required)

E. `GET /users/me`
- No body. Uses `Authorization: Bearer <token>`.

F. `PATCH /users/me` (JSON)
- `nickname`: string (required)
  - Trimmed, non-empty, max 50 characters

4. Output

A. `POST /auth/signup` (201)
```json
{
  "id": "uuid",
  "role": "CLIENT",
  "name": "string",
  "nickname": "string",
  "email": "string",
  "emailVerified": false,
  "biometricAuthEnabled": false,
  "createdAt": "ISO-8601"
}
```

B. `GET /auth/verify-email` (200)
```json
{
  "status": "VERIFIED"
}
```

C. `POST /auth/resend-verification` (200)
```json
{
  "message": "Verification email sent"
}
```

D. `POST /auth/login` (200)
```json
{
  "accessToken": "string",
  "tokenType": "Bearer",
  "expiresInSeconds": 3600,
  "user": {
    "id": "uuid",
    "role": "CLIENT",
    "name": "string",
    "nickname": "string",
    "email": "string",
    "emailVerified": true,
    "biometricAuthEnabled": false,
    "createdAt": "ISO-8601"
  }
}
```

E. `GET /users/me` (200)
```json
{
  "id": "uuid",
  "role": "COMPANION",
  "name": "string",
  "nickname": "string",
  "email": "string",
  "emailVerified": true,
  "biometricAuthEnabled": true,
  "createdAt": "ISO-8601",
  "companionProfile": {
    "id": "uuid",
    "userId": "uuid",
    "designation": "CAPTAIN",
    "isActive": true,
    "languages": [],
    "profilePictureUrl": "",
    "averageRating": 0.00
  }
}
```

F. `PATCH /users/me` (200)
```json
{
  "id": "uuid",
  "role": "CLIENT",
  "name": "string",
  "nickname": "string",
  "email": "string",
  "emailVerified": true,
  "biometricAuthEnabled": false,
  "createdAt": "ISO-8601"
}
```

Error envelope (per Core SDS):
```json
{ "code": "string", "message": "string" }
```

5. Authorization Rules

- Public (no auth):
  - `POST /auth/signup`
  - `GET /auth/verify-email`
  - `POST /auth/resend-verification`
  - `POST /auth/login`
- Requires valid Bearer token:
  - `GET /users/me`
  - `PATCH /users/me`

6. Preconditions

A. `POST /auth/signup`
- `email` must not already exist in `users.email` (unique).
- `role` must be one of `CLIENT|COMPANION`.

B. `GET /auth/verify-email`
- `token` must be a valid server-signed email verification token with:
  - correct signature
  - not expired
  - claim `purpose="EMAIL_VERIFY"`

C. `POST /auth/resend-verification`
- User must exist for `email`.
- `users.email_verified` must be `false` (only resend for unverified users).

D. `POST /auth/login`
- User must exist for `email`.
- Password must match.
- `users.email_verified` must be `true`.
- Request must not exceed rate limit (max 5 failed attempts per 15 minutes per email).

E. `GET /users/me`
- Authorization token must be valid and map to an existing user id.

F. `PATCH /users/me`
- Authenticated user exists.
- `nickname` must be non-empty after trim.
- `nickname` length must not exceed 50 characters.

7. Data Access Mapping

- `users`
  - `id` ↔ user.id
  - `role` ↔ user.role (immutable)
  - `name` ↔ user.name
  - `nickname` ↔ user.nickname
  - `email` ↔ user.email
  - `password_hash` ↔ stored credential (never returned)
  - `email_verified` ↔ user.emailVerified
  - `biometric_auth_enabled` ↔ user.biometricAuthEnabled
  - `created_at` ↔ user.createdAt
- `companion_profiles` (created only when `users.role='COMPANION'`)
  - `user_id` ↔ users.id (1:1)
  - `designation` ↔ companionProfile.designation (assigned at signup)
  - defaults per schema: `is_active=true`, `languages=[]`, `profile_picture_url=''`, `average_rating=0.00`

8. Business Logic

A. `POST /auth/signup`
1. Validate required fields: `role,name,nickname,email,password`.
2. Normalize `email` (trim + lowercase).
3. Validate `role ∈ {CLIENT, COMPANION}`.
4. If `biometricAuthEnabled` is provided in input, use that value; otherwise set to `false`.
5. Hash `password` using bcrypt:
   - use bcrypt rounds from configuration (see Section 17).
6. Insert into `users`:
   - `id = uuid`
   - `role`
   - `name`
   - `nickname`
   - `email`
   - `password_hash = bcryptHash`
   - `email_verified = false`
   - `biometric_auth_enabled = biometricAuthEnabled`
   - `created_at = now()`
7. If `role == COMPANION`, assign companion designation and insert into `companion_profiles`:
  - Assign `designation` at signup:
    - Use a simple balancing rule: if current CAPTAIN count <= VICE_CAPTAIN count, assign CAPTAIN; else assign VICE_CAPTAIN.
   - `id = uuid`
   - `user_id = users.id`
  - `designation = assignedDesignation`
   - rely on schema defaults for remaining fields
8. If `role == COMPANION`, trigger roster slot creation for the next 7 days (owned by Venues & Availability module):
  - Create (or backfill) roster slots for the new companion for all partnered venues and eligible 2-hour windows within operating hours.
  - Slot creation uses upsert semantics to avoid duplicates.
9. Generate an email verification token (JWT):
   - claims:
     - `sub = users.id`
     - `email = users.email`
     - `purpose = "EMAIL_VERIFY"`
     - `exp = now + EMAIL_VERIFY_TOKEN_TTL` (see Section 17)
   - sign with JWT_SECRET from configuration
10. Send verification email (see Section 19 for email configuration):
   - Deep link format: `companion://auth/verify-email?token=<token>`
   - Email send is best-effort; if it fails, user can use resend-verification endpoint
11. Return 201 with the created user profile (excluding password hash).

B. `GET /auth/verify-email`
1. Validate `token` is present.
2. Verify JWT signature and `purpose == "EMAIL_VERIFY"` and not expired.
3. Read `userId = sub` from token.
4. Fetch user by `users.id = userId`.
5. If user not found: return 404 `USER_NOT_FOUND`.
6. If `users.email_verified == true`: return 200 `{status:"VERIFIED"}` (idempotent success).
7. Else update `users.email_verified = true`.
8. Return 200 `{status:"VERIFIED"}`.

C. `POST /auth/resend-verification`
1. Normalize `email` (trim + lowercase).
2. Fetch user by `users.email = email`.
3. If user not found: return 404 `USER_NOT_FOUND`.
4. If `users.email_verified == true`: return 400 `EMAIL_ALREADY_VERIFIED`.
5. Generate a new email verification token (same as signup step 8).
6. Send verification email (see Section 19).
7. Return 200 with `{message: "Verification email sent"}`.

D. `POST /auth/login`
1. Check rate limit: if more than 5 failed login attempts for this email in the last 15 minutes, return 429 `TOO_MANY_ATTEMPTS`.
2. Normalize `email` (trim + lowercase).
3. Fetch user by `users.email = email`.
4. If not found: increment failed attempt counter and return 401 `INVALID_CREDENTIALS`.
5. Verify password using bcrypt compare with `users.password_hash`.
6. If mismatch: increment failed attempt counter and return 401 `INVALID_CREDENTIALS`.
7. If `users.email_verified == false`: return 403 `EMAIL_NOT_VERIFIED`.
8. Reset failed attempt counter for this email.
9. Issue JWT access token:
   - claims:
     - `sub = users.id`
     - `role = users.role`
     - `email = users.email`
     - `exp = now + AUTH_ACCESS_TOKEN_TTL` (see Section 17)
   - sign with JWT_SECRET from configuration
10. Return 200 with token + user profile (excluding password hash).

E. `GET /users/me`
1. Authenticate Bearer token and extract `sub` (user id).
2. Fetch user by id.
3. If `role == COMPANION`, fetch `companion_profiles` by `user_id`.
4. Return merged response.

F. `PATCH /users/me`
1. Authenticate Bearer token and extract `sub` (user id).
2. Validate `nickname` is present.
3. Trim and validate `nickname`:
   - Must be non-empty after trim.
   - Length must not exceed 50 characters.
4. Update `users.nickname` for the authenticated user.
5. Fetch and return updated user profile (exclude password hash).
6. If `role == COMPANION`, include companion profile in response.

9. State Changes

- User state:
  - On signup: `UNVERIFIED` (represented by `users.email_verified=false`)
  - On verify email: `UNVERIFIED → VERIFIED` (set `users.email_verified=true`)
- Role immutability:
  - No API in this module allows changing `users.role` after creation.

10. DB Operations

A. `POST /auth/signup`
- `SELECT 1 FROM users WHERE email = $1` (prevent duplicate)
- `INSERT INTO users (...) VALUES (...)`
- If role=COMPANION:
  - `INSERT INTO companion_profiles (id, user_id) VALUES (...)`

B. `GET /auth/verify-email`
- `SELECT email_verified FROM users WHERE id = $1`
- If not verified:
  - `UPDATE users SET email_verified = true WHERE id = $1`

C. `POST /auth/resend-verification`
- `SELECT id, email, email_verified FROM users WHERE email = $1`

D. `POST /auth/login`
- `SELECT * FROM users WHERE email = $1`
- Rate limit check/update in cache (Redis or similar)

E. `GET /users/me`
- `SELECT * FROM users WHERE id = $1`
- If role=COMPANION:
  - `SELECT * FROM companion_profiles WHERE user_id = $1`

F. `PATCH /users/me`
- `UPDATE users SET nickname = $2 WHERE id = $1 RETURNING *`
- If role=COMPANION:
  - `SELECT * FROM companion_profiles WHERE user_id = $1`

11. Transaction Boundaries

A. `POST /auth/signup`
- Wrap DB writes in a single transaction:
  - Insert `users`
  - Optional insert `companion_profiles`
- Send verification email after transaction commit (best-effort; failure allows user to use resend endpoint).

B. `GET /auth/verify-email`
- Single-row update; can be executed as one statement transactionally.

C. `POST /auth/resend-verification`
- Read-only DB operation; email send outside transaction.

D. `POST /auth/login`
- Read-only DB operations; token issuance and rate limit updates outside DB.

E. `GET /users/me`
- Read-only DB operations.

F. `PATCH /users/me`
- Single-row update; can be executed as one statement transactionally.

12. Constraints

- `users.email` must be unique (DB constraint).
- `users.role` is immutable (enforced at application layer; no endpoint provided to change it).
- `users.password_hash` must never be returned in any response.
- `users.email_verified` must be `true` before login returns a token.
- If `users.role='COMPANION'`, a `companion_profiles` row must exist (created at signup in this module).

13. Concurrency Rules

- Concurrent signups with the same email:
  - DB unique constraint guarantees only one succeeds.
  - The loser must return 409 `EMAIL_ALREADY_EXISTS`.
- Concurrent verify-email calls:
  - Update must be idempotent; multiple calls result in `email_verified=true`.
- Concurrent resend-verification calls:
  - Multiple calls for same email are allowed; each generates new token and sends email.
- Login concurrency:
  - Stateless; each successful login returns a new token.
- Login rate limiting:
  - Failed attempts counter is per-email, stored in cache with 15-minute TTL.
  - Counter increments are atomic.
  - Concurrent failed logins from different IPs for same email share the counter.

14. Failure Cases

- `POST /auth/signup`
  - 400 `VALIDATION_ERROR` (missing/invalid fields)
  - 409 `EMAIL_ALREADY_EXISTS`
  - 500 `INTERNAL_ERROR` (hashing/DB failure; do not leak details)
  - Note: Email send failure does not fail the request; user can use resend endpoint

- `GET /auth/verify-email`
  - 400 `VALIDATION_ERROR` (missing token)
  - 401 `TOKEN_INVALID`
  - 401 `TOKEN_EXPIRED`
  - 404 `USER_NOT_FOUND`
  - 500 `INTERNAL_ERROR`

- `POST /auth/resend-verification`
  - 400 `VALIDATION_ERROR` (missing email)
  - 400 `EMAIL_ALREADY_VERIFIED`
  - 404 `USER_NOT_FOUND`
  - 500 `INTERNAL_ERROR` (email send failure)

- `POST /auth/login`
  - 400 `VALIDATION_ERROR`
  - 401 `INVALID_CREDENTIALS`
  - 403 `EMAIL_NOT_VERIFIED`
  - 429 `TOO_MANY_ATTEMPTS` (rate limit exceeded)
  - 500 `INTERNAL_ERROR`

- `GET /users/me`
  - 401 `UNAUTHORIZED` (missing/invalid token)
  - 404 `USER_NOT_FOUND`
  - 500 `INTERNAL_ERROR`

- `PATCH /users/me`
  - 400 `VALIDATION_ERROR` (missing nickname, empty after trim, or exceeds 50 characters)
  - 401 `UNAUTHORIZED` (missing/invalid token)
  - 404 `USER_NOT_FOUND`
  - 500 `INTERNAL_ERROR`

15. Side Effects

- `POST /auth/signup` sends a verification email to the provided address (best-effort).
- `POST /auth/resend-verification` sends a verification email to the provided address.
- After successful login, client application navigates to home page per master-document/1.1_Onboarding_And_Profile.md section 1.1.2.3 (client-side responsibility).
- No other side effects.

16. Idempotency Rules

- `POST /auth/signup`: not idempotent; duplicate email returns 409.
- `GET /auth/verify-email`: idempotent; if already verified returns 200 `{status:"VERIFIED"}`.
- `POST /auth/resend-verification`: not strictly idempotent (generates new token each time), but safe to retry; returns 400 if already verified.
- `POST /auth/login`: not idempotent; returns a new JWT per successful call.
- `GET /users/me`: idempotent read.
- `PATCH /users/me`: idempotent for identical nickname value.

17. Configuration

The following configuration constants are required (loaded from environment variables):

- `JWT_SECRET`: Secret key for signing JWT tokens (min 32 characters, stored securely)
- `BCRYPT_ROUNDS`: Bcrypt work factor for password hashing (recommended: 12)
- `EMAIL_VERIFY_TOKEN_TTL`: Time-to-live for email verification tokens (recommended: 24 hours)
- `AUTH_ACCESS_TOKEN_TTL`: Time-to-live for authentication access tokens (recommended: 1 hour)
- `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`: Maximum failed login attempts (default: 5)
- `LOGIN_RATE_LIMIT_WINDOW`: Rate limit time window in minutes (default: 15)

18. Client-Side Flows

Biometric Authentication (FaceID/TouchID):
- Implementation is entirely client-side (iOS device-level).
- When user enables `biometricAuthEnabled` during signup:
  - Client app stores user credentials (email + password) in iOS Keychain
  - Keychain entry is protected with `kSecAccessControlBiometryCurrentSet` flag
- On subsequent login with biometric:
  - User taps biometric login option
  - iOS prompts for FaceID/TouchID
  - On biometric success, client retrieves credentials from Keychain
  - Client calls standard `POST /auth/login` endpoint with retrieved credentials
- Server has no biometric-specific logic or endpoints.
- Security: Credentials never leave the device; iOS Keychain provides encryption at rest.

19. Email Configuration

Verification Email Details:
- Email Service: Nodemailer (per tech-stack.md). Uses SMTP transport compatible with any provider or Mailpit for local dev.
- From Address: noreply@companion.app (or configured sender)
- Subject: "Verify your Companion account"
- Body Template:
  ```
  Hi {name},
  
  Welcome to Companion! Please verify your email address by tapping the link below:
  
  [Verify Email]
  
  Or copy and paste this link: {deepLink}
  
  This link expires in 24 hours.
  
  If you didn't create this account, please ignore this email.
  ```
- Deep Link Format: `companion://auth/verify-email?token={token}`
  - React Native app registers `companion://` URL scheme
  - Tapping link opens app and navigates to verification handler
  - Fallback web URL: `https://companion.app/verify-email?token={token}` redirects to app if installed
- Retry Policy: Best-effort send; no automatic retries (user can use resend endpoint)
- Error Handling: Email send failures during signup do not fail the request; log error and allow user to resend
