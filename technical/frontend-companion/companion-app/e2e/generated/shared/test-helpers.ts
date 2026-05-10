/**
 * Shared helpers for FE M02 generated Playwright specs.
 * Auto-generated — do not edit production code from here.
 */

const API_BASE = 'http://localhost:3000';
const MAILPIT_BASE = 'http://localhost:8025';

export interface UserCredentials {
  email: string;
  password: string;
  role: 'CLIENT' | 'COMPANION';
}

/** Generate a unique email with a timestamp suffix */
export function uniqueEmail(prefix = 'fe-test'): string {
  return `${prefix}+${Date.now()}@example.com`;
}

/** Strip Expo Router route groups from a route string for web URL resolution.
 *  e.g. /(auth)/login → /login, /(client)/home → /home
 */
export function resolveWebPath(route: string): string {
  return route.replace(/\/\([^)]+\)/g, '');
}

/** Create a user via the backend signup API */
export async function createUser(params: {
  email: string;
  password: string;
  role: 'CLIENT' | 'COMPANION';
  name: string;
  nickname: string;
}): Promise<{ id: string; email: string }> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: params.role,
      name: params.name,
      nickname: params.nickname,
      email: params.email,
      password: params.password,
      biometricAuthEnabled: false,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Signup failed: ${JSON.stringify(data)}`);
  return { id: data.id, email: data.email };
}

/** Poll Mailpit until a verification email arrives for the given address, then return the token */
export async function getVerificationToken(
  email: string,
  timeoutMs = 15000
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT_BASE}/api/v1/search?query=${encodeURIComponent(email)}`
    );
    const data = await res.json();
    const msgs: any[] = data.messages || [];
    if (msgs.length > 0) {
      const msgRes = await fetch(`${MAILPIT_BASE}/api/v1/message/${msgs[0].ID}`);
      const msg = await msgRes.json();
      const text: string = msg.Text || '';
      // Token appears as: token=<jwt>
      const match = text.match(/token=([A-Za-z0-9._-]+)/);
      if (match) return match[1];
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Timeout waiting for verification email for ${email}`);
}

/** Call the backend verify-email endpoint with the given token */
export async function verifyUserByToken(token: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Verify failed: ${JSON.stringify(data)}`);
}

/** Create a user and immediately verify their email via Mailpit */
export async function createAndVerifyUser(params: {
  email: string;
  password: string;
  role: 'CLIENT' | 'COMPANION';
  name: string;
  nickname: string;
}): Promise<UserCredentials> {
  await createUser(params);
  const token = await getVerificationToken(params.email);
  await verifyUserByToken(token);
  return { email: params.email, password: params.password, role: params.role };
}

/** Create an unverified user (signup only — no email verification) */
export async function createUnverifiedUser(params: {
  email: string;
  password: string;
  role: 'CLIENT' | 'COMPANION';
  name: string;
  nickname: string;
}): Promise<UserCredentials> {
  await createUser(params);
  return { email: params.email, password: params.password, role: params.role };
}

/**
 * Find an old (expired) verification token from Mailpit.
 * Looks for messages older than 25 hours whose body contains a token.
 */
export async function getExpiredVerificationToken(): Promise<string> {
  // Fetch a batch of older messages (start=50 to skip recent ones)
  const res = await fetch(`${MAILPIT_BASE}/api/v1/messages?limit=50&start=50`);
  const data = await res.json();
  const msgs: any[] = data.messages || [];

  const cutoff = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago

  for (const m of msgs) {
    const created = new Date(m.Created).getTime();
    if (created < cutoff) {
      const msgRes = await fetch(`${MAILPIT_BASE}/api/v1/message/${m.ID}`);
      const msg = await msgRes.json();
      const text: string = msg.Text || '';
      const match = text.match(/token=([A-Za-z0-9._-]+)/);
      if (match) return match[1];
    }
  }
  throw new Error('No expired verification token found in Mailpit (no messages older than 25 hours)');
}

/** Inject localStorage values before the page loads.
 *  Call this before page.goto() or use page.addInitScript().
 */
export async function setOnboardingComplete(page: any): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('onboarding_complete', 'true');
  });
}

/** Check that no auth token is present in localStorage (after logout) */
export async function assertNoAuthToken(page: any): Promise<boolean> {
  return page.evaluate(() => {
    const keysToCheck = [
      'auth_token',
      'SecureStore.auth_token',
      'ExpoSecureStore_auth_token',
      '_EXPO_SECURE_STORE_auth_token',
    ];
    return keysToCheck.every((k) => !localStorage.getItem(k));
  });
}
