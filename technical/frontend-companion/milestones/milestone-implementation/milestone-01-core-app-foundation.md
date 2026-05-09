# Milestone 1: Core App Foundation — Implementation Document

**Created:** 2026-05-09  
**Milestone:** 1 — Core App Foundation  
**Status:** Implementation Ready  
**Sources:** `milestone-01-core-app-foundation.md`, `identity-and-auth.feature-sds.md`, `backend-gap-register.md`

---

## Clarity Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Route group restructure now or in Milestone 2? | Restructure into route groups now. Screens are stubbed; Milestone 2 fills them. |
| 2 | Session state: React Context or module-level store? | Zustand module-level store. |
| 3 | Network error on startup: retry UI or treat as expired? | Treat as expired — clear token, navigate to login. |
| 4 | `verify-email.tsx` screen in Milestone 1? | No. Milestone 2 owns that screen. Milestone 1 only confirms Mailpit receives the email at developer level. |

---

## 1. Required Dependencies

Install if not already present. Use `npx expo install` for native packages.

```bash
npx expo install expo-secure-store expo-linking
npx expo install @react-native-async-storage/async-storage
npm install zustand
```

---

## 2. Directory Structure

Restructure `app/` into Expo Router route groups. Existing files are moved; new stubs are created.

### Before (current state)

```
app/
  _layout.tsx
  index.tsx
  onboarding.tsx
  location.tsx
  booking/
    calendar.tsx
    time.tsx
    companion-type.tsx
    book-now.tsx
    confirmation.tsx
  matching.tsx
  in-service.tsx
  feedback.tsx
```

### After (target state)

```
app/
  _layout.tsx                         ← modified: register route groups, own Zustand hydration
  index.tsx                           ← modified: session restore splash
  (auth)/
    _layout.tsx                       ← new: redirect authenticated users away
    login.tsx                         ← new: stub — Milestone 2 builds this
    signup.tsx                        ← new: stub — Milestone 2 builds this
  (client)/
    _layout.tsx                       ← new: guard CLIENT role
    home.tsx                          ← new: stub
    location.tsx                      ← moved from app/location.tsx
    booking/
      calendar.tsx                    ← moved from app/booking/calendar.tsx
      time.tsx                        ← moved
      companion-type.tsx              ← moved
      book-now.tsx                    ← moved
      confirmation.tsx                ← moved
    matching.tsx                      ← moved from app/matching.tsx
    in-service.tsx                    ← moved from app/in-service.tsx
    feedback.tsx                      ← moved from app/feedback.tsx
  (companion)/
    _layout.tsx                       ← new: guard COMPANION role + onboarding check
    home.tsx                          ← new: stub
    onboarding.tsx                    ← moved from app/onboarding.tsx

lib/
  api-client.ts                       ← new
  api/
    auth.ts                           ← new
  config.ts                           ← new
  onboarding-storage.ts               ← new
  placeholder-action.ts               ← new

store/
  session.ts                          ← new: Zustand session store

components/
  ui/
    LoadingScreen.tsx                 ← new
    ErrorScreen.tsx                   ← new
    InlineError.tsx                   ← new
```

---

## 3. Environment Configuration

### `.env.local` (create in `companion-app/`, never commit)

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_ENV=local
```

`EXPO_PUBLIC_` prefix is required for Expo to expose variables to the app bundle.

### `lib/config.ts`

```typescript
export const config = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',
  env: (process.env.EXPO_PUBLIC_ENV ?? 'local') as 'local' | 'staging' | 'production',
};
```

---

## 4. API Client — `lib/api-client.ts`

Base URL reads from `config.apiBaseUrl` (root paths — no `/api/v1` prefix, per FE-BE-GAP-001).

```typescript
import { config } from './config';

const TIMEOUT_MS = 10_000;

export class AppApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AppApiError';
  }
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    try {
      const res = await fetch(`${config.apiBaseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(id);

      if (!res.ok) {
        const err = await res.json().catch(() => ({
          code: 'UNKNOWN_ERROR',
          message: `HTTP ${res.status}`,
        }));
        throw new AppApiError(err.code, err.message, res.status);
      }

      return res.json() as Promise<T>;
    } catch (err) {
      clearTimeout(id);
      if ((err as Error).name === 'AbortError') {
        throw new AppApiError('REQUEST_TIMEOUT', 'Request timed out', 0);
      }
      throw err;
    }
  }

  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body: unknown) { return this.request<T>('POST', path, body); }
  patch<T>(path: string, body: unknown) { return this.request<T>('PATCH', path, body); }
  delete<T>(path: string) { return this.request<T>('DELETE', path); }
}

export const apiClient = new ApiClient();
```

**Retry policy:**
- GET: no retry (a 401 is handled by clearing the session; network errors on startup navigate to login)
- POST / PATCH / DELETE: no retry (non-idempotent)

---

## 5. Auth API Helpers — `lib/api/auth.ts`

Types match `identity-and-auth.feature-sds.md` section 4.

```typescript
import { apiClient } from '../api-client';

export interface SessionUser {
  id: string;
  role: 'CLIENT' | 'COMPANION';
  name: string;
  nickname: string;
  email: string;
  emailVerified: boolean;
  biometricAuthEnabled: boolean;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
  user: SessionUser;
}

export function login(email: string, password: string) {
  return apiClient.post<LoginResponse>('/auth/login', { email, password });
}

export function getMe() {
  return apiClient.get<SessionUser>('/users/me');
}

export function resendVerification(email: string) {
  return apiClient.post<{ message: string }>('/auth/resend-verification', { email });
}
```

---

## 6. Session Store — `store/session.ts`

Zustand module-level store. `apiClient.setToken()` is called inside `login` and `logout` so the singleton API client is always in sync.

```typescript
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '@/lib/api-client';
import type { SessionUser } from '@/lib/api/auth';

const TOKEN_KEY = 'auth_token';

interface SessionState {
  user: SessionUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: SessionUser) => Promise<void>;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  login: async (token, user) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    apiClient.setToken(token);
    set({ user, token });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    apiClient.setToken(null);
    set({ user: null, token: null });
  },

  setLoading: (isLoading) => set({ isLoading }),
}));

/** Read persisted token from SecureStore. Returns null if absent. */
export async function readPersistedToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}
```

---

## 7. Onboarding Storage — `lib/onboarding-storage.ts`

Device-local. Not backend-backed. Used only in the COMPANION route group.

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'onboarding_complete';

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEY, 'true');
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEY);
  return value === 'true';
}
```

---

## 8. Placeholder Action — `lib/placeholder-action.ts`

Apply to every button that is not functional in V1.

```typescript
import { Alert } from 'react-native';

export function placeholderAction() {
  Alert.alert('Coming Soon', 'This feature is coming soon.');
}
```

Usage: `onPress={placeholderAction}`

---

## 9. Shared UI Components

### `components/ui/LoadingScreen.tsx`

Full-screen centered spinner. Used during session restore.

```tsx
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
```

### `components/ui/ErrorScreen.tsx`

Props: `message: string`, `onRetry?: () => void`.

```tsx
import { Button, StyleSheet, Text, View } from 'react-native';

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorScreen({ message, onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      {onRetry && <Button title="Retry" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  text: { textAlign: 'center', marginBottom: 16 },
});
```

### `components/ui/InlineError.tsx`

Single-line error shown below form fields.

```tsx
import { StyleSheet, Text } from 'react-native';

export function InlineError({ message }: { message: string }) {
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: { color: 'red', fontSize: 13, marginTop: 4 },
});
```

### Backend Error Code Mapping

| API `code` | User-facing message |
|---|---|
| `INVALID_CREDENTIALS` | Incorrect email or password |
| `EMAIL_NOT_VERIFIED` | Please verify your email before logging in |
| `USER_NOT_FOUND` | No account found for this email |
| `VALIDATION_ERROR` | Use `error.message` directly |
| `REQUEST_TIMEOUT` | Request timed out. Check your connection |
| anything else | Something went wrong. Please try again |

---

## 10. Root Layout — `app/_layout.tsx`

Registers route groups. Owns session hydration on startup.

```tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="(companion)" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
```

All old flat `Stack.Screen` entries (onboarding, location, booking/*, matching, in-service, feedback) are removed here. They now live inside route group layouts.

---

## 11. Session Restore — `app/index.tsx`

Runs once on app launch. Any failure (401 or network error) clears the token and navigates to login.

```tsx
import React from 'react';
import { useRouter } from 'expo-router';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { getMe } from '@/lib/api/auth';
import { apiClient, AppApiError } from '@/lib/api-client';
import { readPersistedToken, useSessionStore } from '@/store/session';

export default function SessionRestore() {
  const router = useRouter();
  const { login, logout } = useSessionStore();

  React.useEffect(() => {
    async function restore() {
      const token = await readPersistedToken();

      if (!token) {
        router.replace('/(auth)/login');
        return;
      }

      try {
        apiClient.setToken(token);
        const user = await getMe();
        await login(token, user);
        router.replace(user.role === 'COMPANION' ? '/(companion)/home' : '/(client)/home');
      } catch {
        // Any error (401, network error, timeout) → clear session, go to login
        await logout();
        router.replace('/(auth)/login');
      }
    }

    restore();
  }, []);

  return <LoadingScreen />;
}
```

---

## 12. Auth Group — `app/(auth)/_layout.tsx`

Redirects already-authenticated users to their home screen.

```tsx
import { Slot, useRouter } from 'expo-router';
import React from 'react';
import { useSessionStore } from '@/store/session';

export default function AuthLayout() {
  const { user, isLoading } = useSessionStore();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && user) {
      router.replace(user.role === 'COMPANION' ? '/(companion)/home' : '/(client)/home');
    }
  }, [user, isLoading]);

  return <Slot />;
}
```

### Auth Screen Stubs

`app/(auth)/login.tsx` and `app/(auth)/signup.tsx` — minimal stubs. Milestone 2 replaces these.

```tsx
// app/(auth)/login.tsx
import { Text, View } from 'react-native';

export default function LoginScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Login — Milestone 2</Text>
    </View>
  );
}
```

Apply the same pattern for `signup.tsx`.

---

## 13. Client Group — `app/(client)/_layout.tsx`

Requires auth + CLIENT role.

```tsx
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { useSessionStore } from '@/store/session';

export default function ClientLayout() {
  const { user, isLoading } = useSessionStore();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/(auth)/login');
    } else if (user.role !== 'CLIENT') {
      router.replace('/(companion)/home');
    }
  }, [user, isLoading]);

  if (isLoading || !user) return null;

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="home" options={{ title: 'Home' }} />
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

`app/(client)/home.tsx` — stub screen.

---

## 14. Companion Group — `app/(companion)/_layout.tsx`

Requires auth + COMPANION role. Also checks onboarding completion.

```tsx
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { hasCompletedOnboarding } from '@/lib/onboarding-storage';
import { useSessionStore } from '@/store/session';

export default function CompanionLayout() {
  const { user, isLoading } = useSessionStore();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (user.role !== 'COMPANION') {
      router.replace('/(client)/home');
      return;
    }

    hasCompletedOnboarding().then((done) => {
      if (!done) router.replace('/(companion)/onboarding');
    });
  }, [user, isLoading]);

  if (isLoading || !user) return null;

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="home" options={{ title: 'Home' }} />
      <Stack.Screen name="onboarding" options={{ title: 'Onboarding' }} />
    </Stack>
  );
}
```

---

## 15. Role-Based Routing After Login

After `POST /auth/login` succeeds (called from the login screen in Milestone 2):

```typescript
const { login } = useSessionStore();
const response = await loginApi(email, password);
await login(response.accessToken, response.user);
router.replace(response.user.role === 'COMPANION' ? '/(companion)/home' : '/(client)/home');
```

No additional `GET /users/me` call needed at login time. That call is only used during session restore in `app/index.tsx`.

---

## 16. Local Email Verification Infrastructure (Developer Check Only)

Milestone 1 does **not** build a `verify-email.tsx` screen. That is Milestone 2 scope.

Milestone 1 is done when a developer can confirm:

1. Backend `.env` has `SMTP_HOST=localhost` and `SMTP_PORT=1025`
2. Mailpit is running: `http://localhost:8025`
3. Calling `POST /auth/signup` results in an email appearing in Mailpit
4. The email contains a link matching `companion://auth/verify-email?token=<jwt>`

**Mailpit setup (if not already running):**

```bash
# macOS via Homebrew
brew install mailpit
mailpit
# inbox available at http://localhost:8025
# SMTP at localhost:1025
```

**Deep link scheme registration** — add to `app.json`:

```json
{
  "expo": {
    "scheme": "companion"
  }
}
```

This is required so that when Milestone 2 builds the verify-email screen, the `companion://` links open the app.

---

## 17. File Action Summary

| Action | Path |
|---|---|
| **Modify** | `app/_layout.tsx` — route groups, remove old flat screens |
| **Modify** | `app/index.tsx` — session restore logic |
| **Create** | `app/(auth)/_layout.tsx` |
| **Create** | `app/(auth)/login.tsx` (stub) |
| **Create** | `app/(auth)/signup.tsx` (stub) |
| **Create** | `app/(client)/_layout.tsx` |
| **Create** | `app/(client)/home.tsx` (stub) |
| **Move** | `app/location.tsx` → `app/(client)/location.tsx` |
| **Move** | `app/booking/*` → `app/(client)/booking/*` |
| **Move** | `app/matching.tsx` → `app/(client)/matching.tsx` |
| **Move** | `app/in-service.tsx` → `app/(client)/in-service.tsx` |
| **Move** | `app/feedback.tsx` → `app/(client)/feedback.tsx` |
| **Create** | `app/(companion)/_layout.tsx` |
| **Create** | `app/(companion)/home.tsx` (stub) |
| **Move** | `app/onboarding.tsx` → `app/(companion)/onboarding.tsx` |
| **Create** | `store/session.ts` |
| **Create** | `lib/api-client.ts` |
| **Create** | `lib/api/auth.ts` |
| **Create** | `lib/config.ts` |
| **Create** | `lib/onboarding-storage.ts` |
| **Create** | `lib/placeholder-action.ts` |
| **Create** | `components/ui/LoadingScreen.tsx` |
| **Create** | `components/ui/ErrorScreen.tsx` |
| **Create** | `components/ui/InlineError.tsx` |
| **Create** | `.env.local` |
| **Update** | `app.json` — add `"scheme": "companion"` |

---

## 18. Validation Checklist

### Navigation

- [ ] App opens and shows session restore screen (spinner), then redirects
- [ ] No token → lands on `/(auth)/login`
- [ ] Unauthenticated direct access to `/(client)/*` → redirected to login
- [ ] Unauthenticated direct access to `/(companion)/*` → redirected to login
- [ ] Authenticated CLIENT cannot access `/(companion)/*` — redirected to `/(client)/home`
- [ ] Authenticated COMPANION cannot access `/(client)/*` — redirected to `/(companion)/home`
- [ ] Authenticated user on `/(auth)/login` → redirected to role home

### Session Store

- [ ] `login()` writes token to SecureStore under key `auth_token`
- [ ] `logout()` deletes token from SecureStore, clears Zustand state
- [ ] `apiClient` has Bearer token set after `login()`, cleared after `logout()`

### Session Restore

- [ ] App restart with valid token → restores session, routes to correct role home
- [ ] App restart with expired/invalid token (401 from `GET /users/me`) → clears token, routes to login
- [ ] App restart with no network (network error from `GET /users/me`) → clears token, routes to login

### Onboarding Storage

- [ ] New COMPANION (no AsyncStorage flag) → lands on `/(companion)/onboarding`
- [ ] After `markOnboardingComplete()` is called → subsequent launches skip onboarding
- [ ] CLIENT is not checked for onboarding completion

### Placeholder Buttons

- [ ] Tapping a placeholder button shows "This feature is coming soon" alert
- [ ] No navigation or API call is triggered

### Local Email Infrastructure

- [ ] Mailpit running at `http://localhost:8025`
- [ ] Backend SMTP env vars set to `localhost:1025`
- [ ] `POST /auth/signup` causes email to appear in Mailpit
- [ ] Email body contains a `companion://auth/verify-email?token=...` link

### API Client

- [ ] All requests include `Authorization: Bearer <token>` when token is set
- [ ] Request exceeding 10 s throws `AppApiError` with code `REQUEST_TIMEOUT`
- [ ] Backend `{ code, message }` error envelope is parsed into `AppApiError`

---

## 19. Open Gaps and Assumptions

| Gap ID | Status | Impact | Notes |
|---|---|---|---|
| FE-BE-GAP-001 | Open | Low | Backend routes at root (no `/api/v1`). API client built against root paths. Revisit if convention changes. |
| FE-BE-GAP-003 | Open | Blocker (staging) | Staging SMTP not configured. Local Mailpit only. Staging email is deferred. |
| FE-BE-GAP-004 | Open | Low | `companion://` deep link scheme assumed for all environments. Revisit for staging/prod if universal links are needed. |

**Milestone 1 is not done until Mailpit receives the verification email end to end** (signup → Mailpit inbox → link visible with `companion://` scheme). The verify-email screen itself is Milestone 2.
