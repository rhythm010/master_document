# Milestone 2: Identity Flow With Minimum UI — Implementation Document

**Created:** 2026-05-10
**Updated:** 2026-05-10
**Milestone:** 2 — Identity Flow With Minimum UI
**Status:** Implementation Ready
**Output File:** `technical/frontend-companion/milestones/milestone-implementation/milestone-02-identity-flow-minimum-ui-impl.md`

**Sources inspected:**
- `technical/frontend-companion/milestones/milestone-02-identity-flow-minimum-ui.md`
- `technical/frontend-companion/milestones/milestone-implementation/milestone-01-core-app-foundation.md`
- `technical/frontend-companion/backend-gap-register.md`
- `technical/frontend-companion/frontend-backend-contract.md`
- `technical/mobile-frontend-roadmap.md`
- `SDS/feature-sds/identity-and-auth.feature-sds.md`
- `technical/frontend-companion/companion-app/app/(auth)/login.tsx`
- `technical/frontend-companion/companion-app/app/(auth)/signup.tsx`
- `technical/frontend-companion/companion-app/app/(companion)/onboarding.tsx`
- `technical/frontend-companion/companion-app/lib/api/auth.ts`
- `technical/frontend-companion/companion-app/lib/api-client.ts`
- `technical/frontend-companion/companion-app/store/session.ts`
- `technical/frontend-companion/companion-app/app/index.tsx`
- `technical/frontend-companion/companion-app/app/(auth)/_layout.tsx`
- `technical/frontend-companion/companion-app/app/(client)/_layout.tsx`
- `technical/frontend-companion/companion-app/app/(companion)/_layout.tsx`
- `technical/frontend-companion/companion-app/lib/onboarding-storage.ts`
- `technical/frontend-companion/companion-app/components/ui/InlineError.tsx`
- `technical/frontend-companion/companion-app/components/ui/LoadingScreen.tsx`
- `technical/frontend-companion/companion-app/components/ui/ErrorScreen.tsx`
- `technical/frontend-companion/companion-app/app.json`

---

## Scope Summary

Milestone 2 replaces all identity-related stub screens with real, functional (minimum-UI) implementations:

- **Onboarding** — multi-slide onboarding for both CLIENT and COMPANION roles, with local placeholder image assets (colored `View`), back/next/done controls, and local completion state
- **Signup** — single screen with role toggle (CLIENT / COMPANION), name/nickname/email/password fields, `POST /auth/signup` submission, inline error handling
- **Login** — email/password form, `POST /auth/login` submission, `EMAIL_NOT_VERIFIED` handling with resend button, inline errors
- **Logout** — button accessible from both role home screens, calls `useSessionStore.logout()` and redirects to login
- **Email verification** — new `app/(auth)/verify-email.tsx` screen, accessible via deep link `companion://auth/verify-email?token=...`, calls `GET /auth/verify-email?token=...`, shows success/error with navigation
- **Resend verification** — from login screen on `EMAIL_NOT_VERIFIED` and from verify-email screen on `TOKEN_EXPIRED`
- **Profile fetch** — `GET /users/me` already implemented in session restore (`app/index.tsx`); no changes required
- **Route guards** — CLIENT layout updated to also check `hasCompletedOnboarding()`; COMPANION layout already has this guard

Final visual design is explicitly **out of scope**. All forms use plain React Native `TextInput`, `Pressable`, and `Text` components.

---

## Out of Scope

- Final visual design, brand tokens, typography system, illustrations (Milestone 10)
- `app.config.js` dynamic scheme registration (deferred; tracked as FE-BE-GAP-028)
- Biometric login (FaceID/TouchID); the `biometricAuthEnabled` field is sent as `false` in signup
- Password reset / forgot-password flow (out of scope per SDS)
- Web fallback verification URL (`https://companion.app/verify-email?token=...`)
- Push notification integration
- Backend SMTP provider configuration for staging (FE-BE-GAP-003 — still open)
- Remote/CDN media hosting for onboarding slides (FE-BE-GAP-005 — workaround allowed; use local placeholders)
- `PATCH /users/me` (nickname update) — planned for a future profile milestone

---

## Clarity Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Should onboarding apply to both roles? | Yes. Both CLIENT and COMPANION have onboarding. Add `hasCompletedOnboarding()` guard to `(client)/_layout.tsx` and create `app/(client)/onboarding.tsx`. COMPANION layout already has the guard. |
| 2 | How should `EMAIL_NOT_VERIFIED` be surfaced on login? | Catch `EMAIL_NOT_VERIFIED` error code from `POST /auth/login`. Show inline error "Please verify your email before logging in." and render a "Resend Verification Email" button that calls `resendVerification(email)`. Show success/fail feedback inline. |
| 3 | Should signup be one screen or two separate screens? | One screen with a CLIENT/COMPANION role toggle (two pressable buttons). Single `app/(auth)/signup.tsx` submits to `POST /auth/signup` with the selected role. |
| 4 | What should happen on any session restore error? | Keep existing behavior: any error (401, network, timeout) clears the token and navigates to `/(auth)/login`. No change to `app/index.tsx`. |
| 5 | How do we handle the deep link scheme mismatch for local development? | Document `MOBILE_DEEPLINK_SCHEME=companion://` in `technical/backend-companion/.env.example` as a local-dev workaround. This forces the backend to generate `companion://...` deep links, which match the single scheme registered in `app.json`. `app.config.js` dynamic scheme is deferred to a future milestone (FE-BE-GAP-028). |

---

## Open Assumptions / Blockers

| Item | Classification | Detail |
|---|---|---|
| FE-BE-GAP-003 (staging SMTP) | Blocker for staging sign-off | Staging email verification works only when `EMAIL_DELIVERY_MODE=smtp` and an SMTP provider is configured. Local testing uses Mailpit; staging acceptance is blocked. |
| FE-BE-GAP-005 (onboarding media) | Can proceed with workaround | Onboarding slides use solid-color `View` placeholders. Media decision deferred. |
| FE-BE-GAP-028 (scheme mismatch) | Can proceed with workaround | Local dev uses `MOBILE_DEEPLINK_SCHEME=companion://` override. Staging scheme-accurate deep links blocked until `app.config.js` is introduced. |
| `expo-linking` availability | Can proceed with assumption | M01 implementation document listed `npx expo install expo-linking`. `expo-router` (already installed) depends on it. Verify via `cat companion-app/package.json | grep expo-linking` before coding; if absent, run `npx expo install expo-linking`. |
| `verify-email` token expiry + no email on device | Can proceed with workaround | On `TOKEN_EXPIRED`, show a simple email input + resend button on the `verify-email` screen so the user can request a fresh link without going back to login. |

---

## Existing Frontend State

As of Milestone 1 completion, the following is true:

| Item | State |
|---|---|
| `app/(auth)/login.tsx` | Stub — renders static text only |
| `app/(auth)/signup.tsx` | Stub — renders static text only |
| `app/(companion)/onboarding.tsx` | Stub — renders static text only |
| `app/(client)/_layout.tsx` | Guards role and login; does NOT yet check `hasCompletedOnboarding()` |
| `app/(companion)/_layout.tsx` | Guards role, login, AND onboarding completion ✅ |
| `lib/api/auth.ts` | Has `login()`, `getMe()`, `resendVerification()` — missing `signup()` and `verifyEmail()` |
| `store/session.ts` | Complete: `login()`, `logout()`, `setLoading()`, `readPersistedToken()` |
| `lib/onboarding-storage.ts` | Complete: `markOnboardingComplete()`, `hasCompletedOnboarding()` |
| `lib/api-client.ts` | Complete: `AppApiError`, `apiClient` singleton |
| `components/ui/InlineError.tsx` | Complete |
| `components/ui/LoadingScreen.tsx` | Complete |
| `components/ui/ErrorScreen.tsx` | Complete |
| `app.json` | `"scheme": "companion"` — only production scheme registered |
| `app/(client)/home.tsx` | Stub — no logout button |
| `app/(companion)/home.tsx` | Stub — no logout button |

---

## Backend/API Contract Summary

All identity endpoints are **Implemented** in the backend. No new backend work is required for M02. Sources: `SDS/feature-sds/identity-and-auth.feature-sds.md`, `technical/frontend-companion/frontend-backend-contract.md`.

### `POST /auth/signup`

**Path:** `/auth/signup`  
**Auth required:** No  
**Request body:**
```json
{
  "role": "CLIENT" | "COMPANION",
  "name": "string",
  "nickname": "string",
  "email": "string",
  "password": "string",
  "biometricAuthEnabled": false
}
```
**Success (201):**
```json
{
  "id": "uuid",
  "role": "CLIENT|COMPANION",
  "name": "string",
  "nickname": "string",
  "email": "string",
  "emailVerified": false,
  "biometricAuthEnabled": false,
  "createdAt": "ISO-8601"
}
```
Note: `companionProfile` is included when `role=COMPANION`. Frontend can ignore it at signup time.  
**Error codes:** `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_EXISTS`, `500 INTERNAL_ERROR`  
**Side effect:** Backend sends verification email (best-effort). Failure does not fail the request.

---

### `GET /auth/verify-email?token=...`

**Path:** `/auth/verify-email?token=<token>`  
**Auth required:** No  
**Method:** GET (query param only, no body)  
**Success (200):**
```json
{ "status": "VERIFIED" }
```
**Error codes:** `400 VALIDATION_ERROR` (missing token), `401 TOKEN_INVALID`, `401 TOKEN_EXPIRED`, `404 USER_NOT_FOUND`, `500 INTERNAL_ERROR`  
**Idempotent:** Yes — if already verified, returns `200 { status: "VERIFIED" }`.

---

### `POST /auth/resend-verification`

**Path:** `/auth/resend-verification`  
**Auth required:** No  
**Request body:** `{ "email": "string" }`  
**Success (200):** `{ "message": "Verification email sent" }`  
**Error codes:** `400 VALIDATION_ERROR`, `400 EMAIL_ALREADY_VERIFIED`, `404 USER_NOT_FOUND`, `500 INTERNAL_ERROR`

---

### `POST /auth/login`

**Path:** `/auth/login`  
**Auth required:** No  
**Request body:** `{ "email": "string", "password": "string" }`  
**Success (200):**
```json
{
  "accessToken": "string",
  "tokenType": "Bearer",
  "expiresInSeconds": 3600,
  "user": {
    "id": "uuid",
    "role": "CLIENT|COMPANION",
    "name": "string",
    "nickname": "string",
    "email": "string",
    "emailVerified": true,
    "biometricAuthEnabled": false,
    "createdAt": "ISO-8601"
  }
}
```
**Error codes:** `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `403 EMAIL_NOT_VERIFIED`, `429 TOO_MANY_ATTEMPTS`, `500 INTERNAL_ERROR`

---

### `GET /users/me`

**Path:** `/users/me`  
**Auth required:** Yes (`Authorization: Bearer <token>`)  
**Success (200):** `SessionUser` shape (see `lib/api/auth.ts`)  
**Error codes:** `401 UNAUTHORIZED`, `404 USER_NOT_FOUND`, `500 INTERNAL_ERROR`  
**Usage:** Already used in `app/index.tsx` session restore. No changes required.

---

## Backend Gap Impact

| Gap ID | Status | Impact on M02 | Frontend Workaround |
|---|---|---|---|
| FE-BE-GAP-003 | Open | Staging email delivery blocked; local works via Mailpit | `MOBILE_DEEPLINK_SCHEME=companion://` in local `.env`; staging acceptance sign-off is blocked |
| FE-BE-GAP-005 | Open | Onboarding media hosting not available | Use solid-color `View` as image placeholder in each slide |
| FE-BE-GAP-028 | Open (NEW) | Backend generates `companion-dev://` for local but `app.json` only registers `companion` scheme; local deep link taps fail without workaround | Set `MOBILE_DEEPLINK_SCHEME=companion://` in backend `.env` to override scheme; document in `.env.example` |

---

## Required Files

### Create

| File | Reason |
|---|---|
| `app/(auth)/verify-email.tsx` | New screen: deep link landing page for email token verification |
| `app/(client)/onboarding.tsx` | New screen: onboarding for CLIENT role (per Decision 1) |

### Modify

| File | Change Summary |
|---|---|
| `lib/api/auth.ts` | Add `SignupPayload` interface, `signup()` function, `VerifyEmailResponse` interface, `verifyEmail()` function |
| `app/(auth)/login.tsx` | Replace stub with real login form, EMAIL_NOT_VERIFIED handling, resend button |
| `app/(auth)/signup.tsx` | Replace stub with real signup form, role toggle, inline error |
| `app/(companion)/onboarding.tsx` | Replace stub with real multi-slide onboarding, back/next/done, `markOnboardingComplete()` |
| `app/(client)/_layout.tsx` | Add `hasCompletedOnboarding()` guard and `onboarding` screen to Stack |
| `app/(client)/home.tsx` | Add logout button |
| `app/(companion)/home.tsx` | Add logout button |
| `technical/backend-companion/.env.example` | Add `MOBILE_DEEPLINK_SCHEME=companion://` with comment (documentation note only, not app code) |

---

## Route and Navigation Plan

### Current Route Tree (M01 end state)

```
app/
  _layout.tsx
  index.tsx                        ← session restore splash
  (auth)/
    _layout.tsx                    ← redirects authenticated users
    login.tsx                      ← STUB
    signup.tsx                     ← STUB
  (client)/
    _layout.tsx                    ← role guard (no onboarding check)
    home.tsx
    location.tsx
    booking/...
    matching.tsx
    in-service.tsx
    feedback.tsx
  (companion)/
    _layout.tsx                    ← role guard + onboarding check
    home.tsx
    onboarding.tsx                 ← STUB
```

### Target Route Tree (M02 end state)

```
app/
  _layout.tsx                      ← unchanged
  index.tsx                        ← unchanged
  (auth)/
    _layout.tsx                    ← unchanged
    login.tsx                      ← REAL login form
    signup.tsx                     ← REAL signup form with role toggle
    verify-email.tsx               ← NEW: deep link handler
  (client)/
    _layout.tsx                    ← UPDATED: add onboarding check
    home.tsx                       ← UPDATED: add logout button
    onboarding.tsx                 ← NEW: CLIENT onboarding
    location.tsx
    booking/...
    matching.tsx
    in-service.tsx
    feedback.tsx
  (companion)/
    _layout.tsx                    ← unchanged
    home.tsx                       ← UPDATED: add logout button
    onboarding.tsx                 ← REAL multi-slide onboarding
```

### Deep Link Route

`companion://auth/verify-email?token=<token>` → Expo Router resolves to `app/(auth)/verify-email.tsx`

The `(auth)` segment is the route group name. Expo Router deep link path is derived from the filesystem path relative to `app/`, stripping the group prefix. So `app/(auth)/verify-email.tsx` maps to path `auth/verify-email`.

Full deep link: `companion://auth/verify-email?token=<encoded-token>`

### Navigation Flows

| Trigger | Navigate To |
|---|---|
| No persisted token (index.tsx) | `/(auth)/login` |
| Session restore success, role=CLIENT | `/(client)/home` |
| Session restore success, role=COMPANION | `/(companion)/home` |
| Login success, role=CLIENT | `/(client)/home` |
| Login success, role=COMPANION | `/(companion)/home` |
| Signup success | `/(auth)/login` (with success message) |
| Logout | `/(auth)/login` |
| Deep link `companion://auth/verify-email?token=...` | `/(auth)/verify-email` |
| verify-email success | navigate to `/(auth)/login` |
| Onboarding (CLIENT) finish | `/(client)/home` |
| Onboarding (COMPANION) finish | `/(companion)/home` |
| Client/Companion onboarding not done (layout guard) | respective `onboarding` screen |

---

## State Management Plan

No new Zustand stores are required. All form state is local React state (`useState`).

| Store | M02 Changes |
|---|---|
| `store/session.ts` | None — `login()`, `logout()`, `readPersistedToken()` are already complete |

Form state in each screen is component-local `useState`. No global form state.

---

## API Helpers and Types

### File: `lib/api/auth.ts`

**Add the following** (keep all existing exports — `SessionUser`, `LoginResponse`, `login`, `getMe`, `resendVerification`):

```typescript
// --- Signup ---

export interface SignupPayload {
  role: 'CLIENT' | 'COMPANION';
  name: string;
  nickname: string;
  email: string;
  password: string;
  biometricAuthEnabled?: boolean; // always send as false in M02; biometric is out of scope
}

export interface SignupResponse {
  id: string;
  role: 'CLIENT' | 'COMPANION';
  name: string;
  nickname: string;
  email: string;
  emailVerified: boolean;
  biometricAuthEnabled: boolean;
  createdAt: string;
}

export function signup(payload: SignupPayload) {
  return apiClient.post<SignupResponse>('/auth/signup', payload);
}

// --- Email verification ---

export interface VerifyEmailResponse {
  status: 'VERIFIED';
}

export function verifyEmail(token: string) {
  return apiClient.get<VerifyEmailResponse>(
    `/auth/verify-email?token=${encodeURIComponent(token)}`
  );
}
```

**Note:** `apiClient.get<T>(path)` passes the path string directly to `fetch(${config.apiBaseUrl}${path})`, so query params are included in the path string. This is compatible with the existing `ApiClient` implementation.

---

## Screen and UI Behavior

### `app/(auth)/login.tsx` — Real Login Form

**State:**

```typescript
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
const [resendSuccess, setResendSuccess] = useState<string | null>(null);
```

**Imports needed:**
- `login`, `resendVerification` from `@/lib/api/auth`
- `AppApiError` from `@/lib/api-client`
- `useSessionStore` from `@/store/session`
- `InlineError` from `@/components/ui/InlineError`
- `useRouter` from `expo-router`
- `ActivityIndicator`, `Pressable`, `Text`, `TextInput`, `View` from `react-native`

**Submit handler (`handleLogin`):**

```typescript
async function handleLogin() {
  setLoading(true);
  setError(null);
  setUnverifiedEmail(null);
  setResendSuccess(null);

  try {
    const response = await login(email.trim(), password);
    await useSessionStore.getState().login(response.accessToken, response.user);
    router.replace(
      response.user.role === 'COMPANION' ? '/(companion)/home' : '/(client)/home'
    );
  } catch (err) {
    if (err instanceof AppApiError) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(email.trim());
        setError('Please verify your email before logging in.');
      } else if (err.code === 'INVALID_CREDENTIALS') {
        setError('Incorrect email or password.');
      } else if (err.code === 'TOO_MANY_ATTEMPTS') {
        setError('Too many login attempts. Please wait 15 minutes and try again.');
      } else if (err.code === 'VALIDATION_ERROR') {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } else {
      setError('Something went wrong. Please try again.');
    }
  } finally {
    setLoading(false);
  }
}
```

**Resend handler (`handleResend`):**

```typescript
async function handleResend() {
  if (!unverifiedEmail) return;
  setLoading(true);
  setResendSuccess(null);
  setError(null);

  try {
    await resendVerification(unverifiedEmail);
    setResendSuccess('Verification email sent. Check your inbox.');
  } catch (err) {
    if (err instanceof AppApiError) {
      setError(err.message);
    } else {
      setError('Something went wrong. Please try again.');
    }
  } finally {
    setLoading(false);
  }
}
```

**UI layout (minimum functional):**

```
<View> (flex, centered)
  <Text> "Login" </Text>

  <TextInput> email (keyboardType="email-address", autoCapitalize="none") </TextInput>
  <TextInput> password (secureTextEntry) </TextInput>

  {error && <InlineError message={error} />}
  {resendSuccess && <Text style={{ color: 'green' }}>{resendSuccess}</Text>}

  {unverifiedEmail && (
    <Pressable onPress={handleResend} disabled={loading}>
      <Text>"Resend Verification Email"</Text>
    </Pressable>
  )}

  <Pressable onPress={handleLogin} disabled={loading}>
    {loading ? <ActivityIndicator /> : <Text>"Log In"</Text>}
  </Pressable>

  <Pressable onPress={() => router.push('/(auth)/signup')}>
    <Text>"Don't have an account? Sign up"</Text>
  </Pressable>
</View>
```

**Behavior rules:**
- Submit button is disabled while `loading === true`
- `TextInput` fields are `editable={!loading}`
- On successful login, navigate using `router.replace()` (not `push`) so the user cannot back-navigate to login
- `unverifiedEmail` is set to the last-attempted email on `EMAIL_NOT_VERIFIED`; the resend button targets this email
- Both `error` and `resendSuccess` are cleared at the start of each submit/resend attempt

---

### `app/(auth)/signup.tsx` — Real Signup Form

**State:**

```typescript
const [role, setRole] = useState<'CLIENT' | 'COMPANION'>('CLIENT');
const [name, setName] = useState('');
const [nickname, setNickname] = useState('');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Imports needed:**
- `signup` from `@/lib/api/auth`
- `AppApiError` from `@/lib/api-client`
- `InlineError` from `@/components/ui/InlineError`
- `useRouter` from `expo-router`
- `ActivityIndicator`, `Pressable`, `Text`, `TextInput`, `View` from `react-native`

**Submit handler (`handleSignup`):**

```typescript
async function handleSignup() {
  setLoading(true);
  setError(null);

  try {
    await signup({
      role,
      name: name.trim(),
      nickname: nickname.trim(),
      email: email.trim(),
      password,
      biometricAuthEnabled: false,
    });
    // Success: navigate to login with success context
    router.replace('/(auth)/login');
    // Note: Expo Router does not support passing route state natively.
    // The success message "Account created! Please check your email to verify your account."
    // should be displayed on the login screen via a query param or a simple Alert before navigating.
    // Use Alert.alert for M02:
    // Alert.alert('Account Created', 'Please check your email to verify your account.', [
    //   { text: 'OK', onPress: () => router.replace('/(auth)/login') },
    // ]);
    // Replace the router.replace above with the Alert approach.
  } catch (err) {
    if (err instanceof AppApiError) {
      if (err.code === 'EMAIL_ALREADY_EXISTS') {
        setError('An account with this email already exists.');
      } else if (err.code === 'VALIDATION_ERROR') {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } else {
      setError('Something went wrong. Please try again.');
    }
  } finally {
    setLoading(false);
  }
}
```

**Implementation note on success message:** Use `Alert.alert('Account Created', 'Please check your email to verify your account.', [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }])`. This is the simplest M02-compatible approach that does not require query params or shared state. The `router.replace` call inside the Alert callback navigates after the user dismisses the alert.

**UI layout (minimum functional):**

```
<View> (flex, centered)
  <Text> "Create Account" </Text>

  {/* Role Toggle */}
  <View style={{ flexDirection: 'row' }}>
    <Pressable onPress={() => setRole('CLIENT')} style={role === 'CLIENT' ? selectedStyle : {}}>
      <Text>"Client"</Text>
    </Pressable>
    <Pressable onPress={() => setRole('COMPANION')} style={role === 'COMPANION' ? selectedStyle : {}}>
      <Text>"Companion"</Text>
    </Pressable>
  </View>

  <TextInput> name </TextInput>
  <TextInput> nickname </TextInput>
  <TextInput> email (keyboardType="email-address", autoCapitalize="none") </TextInput>
  <TextInput> password (secureTextEntry) </TextInput>

  {error && <InlineError message={error} />}

  <Pressable onPress={handleSignup} disabled={loading}>
    {loading ? <ActivityIndicator /> : <Text>"Create Account"</Text>}
  </Pressable>

  <Pressable onPress={() => router.push('/(auth)/login')}>
    <Text>"Already have an account? Log in"</Text>
  </Pressable>
</View>
```

**Behavior rules:**
- Default role is `'CLIENT'`
- Selected role toggle tab has a visible active style (e.g., `backgroundColor: '#000'`, `color: '#fff'` — minimal)
- Submit button disabled while `loading === true`
- All `TextInput` fields `editable={!loading}`

---

### `app/(auth)/verify-email.tsx` — New Screen

**Purpose:** Deep link landing page. Receives the verification token from the URL, calls the backend, shows result.

**Imports needed:**
- `useLocalSearchParams`, `useRouter` from `expo-router`
- `verifyEmail`, `resendVerification` from `@/lib/api/auth`
- `AppApiError` from `@/lib/api-client`
- `ActivityIndicator`, `Pressable`, `Text`, `TextInput`, `View` from `react-native`

**State:**

```typescript
const { token } = useLocalSearchParams<{ token: string }>();
const [status, setStatus] = useState<'loading' | 'success' | 'expired' | 'invalid' | 'no-token'>('loading');
const [resendEmail, setResendEmail] = useState('');
const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
const [resendError, setResendError] = useState<string | null>(null);
```

**On mount effect:**

```typescript
useEffect(() => {
  if (!token) {
    setStatus('no-token');
    return;
  }

  verifyEmail(token)
    .then(() => setStatus('success'))
    .catch((err) => {
      if (err instanceof AppApiError) {
        if (err.code === 'TOKEN_EXPIRED') {
          setStatus('expired');
        } else {
          setStatus('invalid');
        }
      } else {
        setStatus('invalid');
      }
    });
}, []); // token is stable from URL params; no re-run needed
```

**Resend handler (for `expired` state):**

```typescript
async function handleResend() {
  if (!resendEmail.trim()) {
    setResendError('Please enter your email address.');
    return;
  }
  setResendStatus('sending');
  setResendError(null);
  try {
    await resendVerification(resendEmail.trim());
    setResendStatus('sent');
  } catch (err) {
    setResendStatus('error');
    if (err instanceof AppApiError) {
      setResendError(err.message);
    } else {
      setResendError('Something went wrong. Please try again.');
    }
  }
}
```

**UI by status:**

- **`loading`**: Full-screen `<ActivityIndicator />` — "Verifying your email..."
- **`success`**: Text "Email verified! You can now log in." + `<Pressable onPress={() => router.replace('/(auth)/login')}>` "Go to Login"
- **`expired`**: Text "This verification link has expired." + `<TextInput>` for email + "Resend Verification Email" button + feedback on resend result
- **`invalid`** or **`no-token`**: Text "Invalid or missing verification link." + `<Pressable>` "Go to Login"

**Navigation:**
- `router.replace('/(auth)/login')` on success and on the go-to-login button (use `replace` so user cannot back-navigate to verify-email)

**Deep link note:**
- `useLocalSearchParams` from `expo-router` is the correct API for reading query params in a file-based route. No `expo-linking` direct usage is needed in the screen code.
- The typed generic `useLocalSearchParams<{ token: string }>()` narrows the return to `string` (not `string[]`). Pass `token` directly to `verifyEmail(token)` — no array guard needed.

---

### `app/(companion)/onboarding.tsx` — Real Multi-Slide Onboarding

**State:**

```typescript
const [currentSlide, setCurrentSlide] = useState(0);
const router = useRouter();
```

**Slides data (defined as a constant, not fetched):**

```typescript
const SLIDES = [
  {
    title: 'Welcome to Companion',
    body: 'Your trusted companion experience starts here.',
  },
  {
    title: 'Be a Great Companion',
    body: 'Show up on time, be professional, and make every session count.',
  },
  {
    title: 'Ready to Begin',
    body: 'Complete your profile and start accepting bookings.',
  },
];
```

**Image placeholder:** Each slide uses a solid-color `<View style={{ width: '100%', height: 200, backgroundColor: '#E0E0E0' }} />` in place of an image. This is the M02 workaround for FE-BE-GAP-005. No remote fetch, no bundled image assets required.

**Navigation controls:**

```typescript
function handleBack() {
  setCurrentSlide((prev) => prev - 1);
}

async function handleNext() {
  if (currentSlide < SLIDES.length - 1) {
    setCurrentSlide((prev) => prev + 1);
  } else {
    await markOnboardingComplete();
    router.replace('/(companion)/home');
  }
}
```

**UI layout:**

```
<View> (flex)
  {/* Image placeholder */}
  <View style={{ height: 200, backgroundColor: '#E0E0E0' }} />

  <Text>{SLIDES[currentSlide].title}</Text>
  <Text>{SLIDES[currentSlide].body}</Text>

  {/* Slide indicator */}
  <Text>{currentSlide + 1} / {SLIDES.length}</Text>

  <View style={{ flexDirection: 'row' }}>
    {currentSlide > 0 && (
      <Pressable onPress={handleBack}>
        <Text>"Back"</Text>
      </Pressable>
    )}
    <Pressable onPress={handleNext}>
      <Text>{currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}</Text>
    </Pressable>
  </View>
</View>
```

**Behavior rules:**
- Back button is hidden (not just disabled) on the first slide (`currentSlide === 0`)
- Last slide shows "Get Started" on the next button
- `markOnboardingComplete()` is called before navigation on "Get Started"
- After completion, `(companion)/_layout.tsx` guard will route past onboarding on all future app opens (guard already implemented in M01)
- No animations required in M02

---

### `app/(client)/onboarding.tsx` — New Screen

Same implementation as `app/(companion)/onboarding.tsx` with one change:

- On "Get Started": `router.replace('/(client)/home')` instead of `/(companion)/home`

```typescript
async function handleNext() {
  if (currentSlide < SLIDES.length - 1) {
    setCurrentSlide((prev) => prev + 1);
  } else {
    await markOnboardingComplete();
    router.replace('/(client)/home');
  }
}
```

All other state, slide data, and UI are identical to the Companion onboarding.

**Imports needed:**
- `markOnboardingComplete` from `@/lib/onboarding-storage`
- `useRouter` from `expo-router`
- `Pressable`, `Text`, `View` from `react-native`

---

### `app/(client)/_layout.tsx` — Updated

**Changes required:**

1. Import `hasCompletedOnboarding` from `@/lib/onboarding-storage`
2. Add onboarding check inside the effect (after role check)
3. Add `<Stack.Screen name="onboarding" />` to the Stack

**Updated layout:**

```typescript
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { hasCompletedOnboarding } from '@/lib/onboarding-storage';
import { useSessionStore } from '@/store/session';

export default function ClientLayout() {
  const { user, isLoading } = useSessionStore();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (user.role !== 'CLIENT') {
      router.replace('/(companion)/home');
      return;
    }
    hasCompletedOnboarding().then((done) => {
      if (!done) router.replace('/(client)/onboarding');
    });
  }, [router, user, isLoading]);

  if (isLoading || !user) return null;

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="home" options={{ title: 'Home' }} />
      <Stack.Screen name="onboarding" options={{ title: 'Onboarding', headerShown: false }} />
      <Stack.Screen name="location" options={{ title: 'Location' }} />
      <Stack.Screen name="booking/calendar" options={{ title: 'Calendar' }} />
      <Stack.Screen name="booking/time" options={{ title: 'Time' }} />
      <Stack.Screen name="booking/companion-type" options={{ title: 'Companion Type' }} />
      <Stack.Screen name="booking/book-now" options={{ title: 'Book Now' }} />
      <Stack.Screen name="booking/confirmation" options={{ title: 'Confirmation' }} />
      <Stack.Screen name="matching" options={{ title: 'Matching' }} />
      <Stack.Screen name="in-service" options={{ title: 'In Service' }} />
      <Stack.Screen name="feedback" options={{ title: 'Feedback' }} />
    </Stack>
  );
}
```

**Behavior rules:**
- Onboarding check runs only after role check passes
- Onboarding screen has `headerShown: false` (no back arrow — user must complete onboarding)
- This mirrors the existing `(companion)/_layout.tsx` behavior exactly

---

### `app/(client)/home.tsx` and `app/(companion)/home.tsx` — Add Logout Button

Both home screens currently render a stub. Add a logout button that calls `useSessionStore.logout()` and navigates to login.

**Addition to each home screen:**

```typescript
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSessionStore } from '@/store/session';

// Inside the component:
const router = useRouter();
const { logout } = useSessionStore();

async function handleLogout() {
  await logout();
  router.replace('/(auth)/login');
}

// In the return:
<Pressable onPress={handleLogout}>
  <Text>Logout</Text>
</Pressable>
```

**Placement:** Add the Logout `Pressable` anywhere visible on the stub home screen. No specific layout requirement — functional placement is sufficient for M02.

---

## Loading, Error, and Empty States

| Screen | Loading State | Error State | Empty / No-Data State |
|---|---|---|---|
| `login.tsx` | `ActivityIndicator` replaces button label; all inputs `editable={false}` | `InlineError` below form; resend button if `EMAIL_NOT_VERIFIED` | N/A |
| `signup.tsx` | `ActivityIndicator` replaces button label; all inputs `editable={false}` | `InlineError` below form | N/A |
| `verify-email.tsx` | Full-screen centered `ActivityIndicator` | Status-conditional text (expired / invalid / no-token) | N/A |
| `onboarding.tsx` | N/A (no async on screen) | N/A | N/A |

---

## Persistence and Storage

| Data | Storage | Details |
|---|---|---|
| Auth token | `expo-secure-store` via `store/session.ts` | Already implemented in M01; login/logout handled by `useSessionStore` |
| Onboarding completion | `@react-native-async-storage/async-storage` via `lib/onboarding-storage.ts` | `markOnboardingComplete()` and `hasCompletedOnboarding()` already implemented |

No new storage mechanisms are required in M02.

---

## Deep Link Handling

### Registered Scheme

`app.json` currently registers `"scheme": "companion"`. This means the app responds to `companion://` deep links.

**Deep link format for M02:**
```
companion://auth/verify-email?token=<encoded-token>
```

### Expo Router Path Resolution

Expo Router resolves deep links by stripping the scheme and matching the path against the filesystem:

- Scheme: `companion://`
- Path: `auth/verify-email`
- Query: `token=<token>`
- Resolves to: `app/(auth)/verify-email.tsx` (route group `(auth)` is stripped from the URL path)
- `useLocalSearchParams()` returns `{ token: "<token>" }`

No additional `expo-linking` configuration or `Linking.addEventListener` code is needed in the screen. Expo Router handles deep link routing automatically.

### M02 Workaround for Scheme Mismatch (FE-BE-GAP-028)

The backend defaults to generating `companion-dev://` deep links when `APP_ENV=local`. Since `app.json` only registers `companion`, local device testing with default backend config would fail to open the app from a tapped email link.

**Workaround:** Set `MOBILE_DEEPLINK_SCHEME=companion://` in the local backend `.env`. This overrides the backend's computed scheme and forces all generated deep links to use `companion://`, which the app can handle.

**Simulator workaround** (does not require tapping an email):
```bash
xcrun simctl openurl booted "companion://auth/verify-email?token=<token-from-mailpit>"
```

### Future Resolution

Deferred to a future milestone: introduce `app.config.js` that reads `EXPO_PUBLIC_APP_ENV` and sets `scheme` to `companion-dev`, `companion-staging`, or `companion` per build profile. This resolves FE-BE-GAP-028 completely.

---

## Local Development Setup

### Prerequisites

All prerequisites were established in Milestone 0 and 1. Verify before starting M02 testing:

- Expo dev server running: `cd companion-app && npx expo start`
- Backend running: `cd technical/backend-companion && npm run dev`
- Docker running (for Postgres)
- Mailpit running: `http://localhost:8025`

### Environment Variables

**`companion-app/.env.local`** (already set up in M01, no changes for M02):
```
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_ENV=local
```

**`technical/backend-companion/.env`** (add the following if not already present):
```
# M02 local dev workaround for FE-BE-GAP-028.
# Forces the backend to generate companion:// deep links, matching the scheme
# registered in companion-app/app.json. Without this, local deep links use
# companion-dev:// which the app does not recognize.
# Remove this override once app.config.js introduces per-environment scheme registration.
MOBILE_DEEPLINK_SCHEME=companion://
```

Document this in `technical/backend-companion/.env.example` with the same comment.

### Local Email Verification Testing Flow

1. Start all services (see Prerequisites)
2. In the app: navigate to `/(auth)/signup`, fill the form, submit
3. Open Mailpit at `http://localhost:8025` — a verification email should appear
4. Copy the `token` query parameter from the deep link in the email body
5. **Option A (Simulator):** Run:
   ```bash
   xcrun simctl openurl booted "companion://auth/verify-email?token=<paste-token-here>"
   ```
6. **Option B (Real device via Expo Go):** Tap the link in a real email client. The link must use `companion://` — confirmed by the `MOBILE_DEEPLINK_SCHEME=companion://` override above.
7. The app opens `verify-email.tsx`, shows "Verifying..." then "Email verified! You can now log in."
8. Navigate to login and sign in with the now-verified credentials

---

## Environment and Config

No new environment variables or config changes are required in the frontend app for M02.

| Config | Source | M02 Status |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `companion-app/.env.local` | Set in M01; no change |
| `EXPO_PUBLIC_ENV` | `companion-app/.env.local` | Set in M01; no change |
| `app.json scheme` | `companion-app/app.json` | `"companion"` — no change in M02 (FE-BE-GAP-028 deferred) |
| Backend `MOBILE_DEEPLINK_SCHEME` | `technical/backend-companion/.env` | Add `companion://` for local dev; document in `.env.example` |

---

## Implementation Phases

### Phase 1 — API Types and Helpers

**Files:** `lib/api/auth.ts`

**Tasks:**
1. Add `SignupPayload` interface
2. Add `SignupResponse` interface
3. Add `signup(payload: SignupPayload)` function
4. Add `VerifyEmailResponse` interface
5. Add `verifyEmail(token: string)` function

**Validation:** TypeScript compilation passes. Test with `npx tsc --noEmit` from `companion-app/`.

**Dependencies:** None — uses existing `apiClient`.

---

### Phase 2 — Login Screen

**Files:** `app/(auth)/login.tsx`

**Tasks:**
1. Replace stub with full form component
2. Implement `email`, `password`, `loading`, `error`, `unverifiedEmail`, `resendSuccess` state
3. Implement `handleLogin()` — calls `login()`, dispatches to `useSessionStore.login()`, navigates by role
4. Handle `EMAIL_NOT_VERIFIED` → set `unverifiedEmail`, show resend button
5. Handle `INVALID_CREDENTIALS`, `TOO_MANY_ATTEMPTS`, `VALIDATION_ERROR`, other errors
6. Implement `handleResend()` — calls `resendVerification(unverifiedEmail)`, shows inline success/fail
7. Add link to `/(auth)/signup`

**Validation:**
- Submit with wrong credentials → shows "Incorrect email or password."
- Submit with unverified account → shows inline error + resend button
- Tap resend → inline success message appears
- Submit valid credentials → navigates to role-appropriate home
- Button disabled and inputs non-editable while loading

**Dependencies:** Phase 1 (for `login` function, already exists; just confirm no TypeScript errors).

---

### Phase 3 — Signup Screen

**Files:** `app/(auth)/signup.tsx`

**Tasks:**
1. Replace stub with full form component
2. Implement `role`, `name`, `nickname`, `email`, `password`, `loading`, `error` state
3. Render role toggle (two `Pressable` buttons)
4. Implement `handleSignup()` — calls `signup({ role, name, nickname, email, password, biometricAuthEnabled: false })`
5. On success: `Alert.alert('Account Created', '...', [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }])`
6. Handle `EMAIL_ALREADY_EXISTS`, `VALIDATION_ERROR`, other errors with `InlineError`
7. Add link back to `/(auth)/login`

**Validation:**
- Toggle between Client / Companion — active tab has visible active style
- Submit with duplicate email → "An account with this email already exists."
- Submit with all valid fields → Alert shown, then navigates to login
- Submit button disabled while loading

**Dependencies:** Phase 1 (`signup` function).

---

### Phase 4 — Verify Email Screen

**Files:** `app/(auth)/verify-email.tsx` (create)

**Tasks:**
1. Create new file
2. Implement `useLocalSearchParams` to read `token`
3. Implement status state machine: `loading | success | expired | invalid | no-token`
4. On mount: if no token → `setStatus('no-token')`; else call `verifyEmail(token)`
5. Handle `TOKEN_EXPIRED` → `setStatus('expired')` + show email input + resend button
6. Handle all other errors → `setStatus('invalid')`
7. On success → `setStatus('success')` + "Go to Login" button
8. Implement `handleResend()` for expired state

**Validation:**
- With valid token: shows "Email verified!" + Go to Login button
- With expired token: shows expired message + email input + resend button
- With no token / invalid token: shows "Invalid or missing verification link." + Go to Login
- Simulator deep link test: `xcrun simctl openurl booted "companion://auth/verify-email?token=<valid-token>"`

**Dependencies:** Phase 1 (`verifyEmail` function).

---

### Phase 5 — Onboarding Screens

**Files:** `app/(companion)/onboarding.tsx` (modify), `app/(client)/onboarding.tsx` (create)

**Tasks:**
1. Modify `app/(companion)/onboarding.tsx`: replace stub with 3-slide implementation
2. Create `app/(client)/onboarding.tsx`: same implementation, navigates to `/(client)/home`
3. Slides: 3 items with `title` + `body` text + solid-color `View` placeholder (height 200, `backgroundColor: '#E0E0E0'`)
4. Back button: hidden on slide 0; visible on slides 1–2
5. Next/Get Started button: label changes on last slide
6. On "Get Started": `await markOnboardingComplete()` then `router.replace(...)`

**Validation:**
- Open as a new user (clear AsyncStorage) → onboarding shows
- Navigate through all 3 slides using Next/Back
- Tap "Get Started" → navigates to appropriate home
- Re-open app → onboarding does not show again (layout guard catches `hasCompletedOnboarding() === true`)

**Dependencies:** None (uses existing `markOnboardingComplete` and `useRouter`).

---

### Phase 6 — Layout Updates

**Files:** `app/(client)/_layout.tsx`

**Tasks:**
1. Import `hasCompletedOnboarding` from `@/lib/onboarding-storage`
2. Add `hasCompletedOnboarding().then((done) => { if (!done) router.replace('/(client)/onboarding'); })` inside the effect, after role check
3. Add `<Stack.Screen name="onboarding" options={{ title: 'Onboarding', headerShown: false }} />` to the Stack

**Validation:**
- Fresh install / cleared AsyncStorage: CLIENT user is routed to `/(client)/onboarding`
- After completing onboarding: CLIENT user goes directly to `/(client)/home`

**Dependencies:** Phase 5 (`app/(client)/onboarding.tsx` must exist).

---

### Phase 7 — Logout Buttons

**Files:** `app/(client)/home.tsx`, `app/(companion)/home.tsx`

**Tasks:**
1. Add `handleLogout` function: `await logout(); router.replace('/(auth)/login')`
2. Add `<Pressable onPress={handleLogout}><Text>Logout</Text></Pressable>` to each screen

**Validation:**
- Tap Logout → navigates to login screen
- Session store is cleared (token removed from SecureStore)
- Navigating back after logout shows login screen, not home

**Dependencies:** None (uses existing `useSessionStore.logout()`).

---

### Phase 8 — Documentation and Local Dev Setup

**Files:** `technical/backend-companion/.env.example`

**Tasks:**
1. Add `MOBILE_DEEPLINK_SCHEME=companion://` with comment explaining FE-BE-GAP-028 workaround

**Validation:**
- `.env.example` contains the new variable with explanatory comment
- Backend restarts with `MOBILE_DEEPLINK_SCHEME=companion://` in `.env` generate `companion://auth/verify-email?token=...` links in Mailpit

**Dependencies:** None.

---

## Validation and Test Plan

### Simulator Validation (required for all items)

| Scenario | Expected Result |
|---|---|
| First launch (no token) | Navigates to `/(auth)/login` |
| Signup as CLIENT, all fields valid | Alert "Account Created", then login screen |
| Signup as COMPANION, all fields valid | Alert "Account Created", then login screen |
| Signup with duplicate email | Inline error "An account with this email already exists." |
| Login with wrong password | Inline error "Incorrect email or password." |
| Login with unverified account | Inline error + "Resend Verification Email" button |
| Tap resend on login screen | Inline success "Verification email sent. Check your inbox." |
| Login with valid verified credentials (CLIENT) | Navigates to `/(client)/home` |
| Login with valid verified credentials (COMPANION) | Navigates to `/(companion)/home` |
| Fresh CLIENT user (no onboarding) | After login, redirected to `/(client)/onboarding` |
| Fresh COMPANION user (no onboarding) | After login, redirected to `/(companion)/onboarding` |
| Complete CLIENT onboarding | Navigates to `/(client)/home`; re-launch skips onboarding |
| Complete COMPANION onboarding | Navigates to `/(companion)/home`; re-launch skips onboarding |
| Onboarding Back button on first slide | Back button is not visible |
| Onboarding last slide | Button label is "Get Started" |
| Tap Logout from CLIENT home | Navigates to `/(auth)/login`; token cleared |
| Tap Logout from COMPANION home | Navigates to `/(auth)/login`; token cleared |
| Session restore with valid token | Navigates to role-appropriate home (no login required) |
| Session restore with expired/invalid token | Navigates to `/(auth)/login` |
| `verify-email` with valid token (simulator deep link) | "Email verified!" + Go to Login button |
| `verify-email` with expired token | Expired message + email input + resend button |
| `verify-email` with no token (`/auth/verify-email` directly) | "Invalid or missing verification link." |
| `verify-email` resend with email | Success message after resend |

### Real Device Validation (required for deep link and session persistence)

| Scenario | Expected Result |
|---|---|
| Tap verification deep link from real email client | App opens, `verify-email.tsx` shows, verifies token |
| Close and reopen app with valid session | Session restored, navigates to home without login |
| Token expires (test with short TTL in dev) | Session restore fails, navigates to login |

### Manual Mailpit Flow

1. Signup → verify email arrives in Mailpit (`http://localhost:8025`)
2. Extract token from link in email
3. Simulator: `xcrun simctl openurl booted "companion://auth/verify-email?token=<token>"`
4. Verify `status: VERIFIED` shown in app → navigate to login → log in successfully

---

## Done Criteria

- A CLIENT user can create an account and see success feedback.
- A COMPANION user can create an account and see success feedback.
- Both roles can verify email via deep link on simulator (using `xcrun simctl openurl`).
- Both roles can log in with verified credentials.
- `EMAIL_NOT_VERIFIED` error on login shows inline error and a working "Resend Verification Email" button.
- Both roles complete onboarding once and skip it on subsequent launches.
- Both roles remain authenticated after closing and reopening the app (session restore via `GET /users/me`).
- Both home screens have a working Logout button.
- The `verify-email` screen handles success, expired token (with resend), invalid token, and no-token states.
- TypeScript compilation passes with no errors (`npx tsc --noEmit`).
- No permanent mocks — all screens make real API calls to the local backend.

---

## Coder-Agent Notes

- **Do not modify** `app/index.tsx`, `lib/api-client.ts`, `store/session.ts`, `lib/onboarding-storage.ts`, `components/ui/*`, or `app/_layout.tsx`. These are complete and correct from M01.
- **Do not modify** `app/(auth)/_layout.tsx` or `app/(companion)/_layout.tsx`. They are correct.
- **`apiClient.get<T>(path)`** includes query params in the path string: `apiClient.get('/auth/verify-email?token=' + encodeURIComponent(token))`.
- **`useSessionStore.getState().login()`** is used inside async submit handlers (not the hook). Alternatively, call `useSessionStore()` hook and destructure `login` at component level — both work. Prefer the hook approach for consistency with `logout` usage.
- **`router.replace()`** (not `router.push()`) for all post-auth navigations to prevent back-navigation to auth screens.
- **`expo-linking`** is likely already installed from M01 (`npx expo install expo-linking` was listed in M01 dependencies). Verify with `cat companion-app/package.json | grep expo-linking`. If absent, run `npx expo install expo-linking` (though it is not directly used in screen code — Expo Router uses it internally).
- **Do not introduce `app.config.js`** in M02. The scheme mismatch is handled by the backend `.env` override.
- **Slide placeholder** is a solid-color `<View>`, not an `<Image>`. No image assets or imports required for onboarding.
- **No animations** required on onboarding slides. `currentSlide` drives a simple conditional render.
- Execute phases in order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Phases are independent except Phase 6 depends on Phase 5.

---

## Backend Gap References

| Gap ID | Title | Status | M02 Impact | Workaround |
|---|---|---|---|---|
| FE-BE-GAP-003 | Staging Email Provider And Verification Config | Open | Staging email verification blocked; local Mailpit works | Use Mailpit locally; staging acceptance sign-off is blocked until SMTP is configured |
| FE-BE-GAP-005 | Onboarding Media Hosting And Download-Once Strategy | Open | No media hosting available for onboarding slides | Use solid-color `<View>` placeholder (200px height) instead of images |
| FE-BE-GAP-028 | Per-Environment Expo Scheme Registration Mismatch | Open (NEW) | Backend generates `companion-dev://` locally but `app.json` registers `companion` only; local device deep link taps fail | Set `MOBILE_DEEPLINK_SCHEME=companion://` in `technical/backend-companion/.env`; use `xcrun simctl openurl` for simulator testing |
