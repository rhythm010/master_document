/**
 * FE-M02-IDENTITY-005 — Login COMPANION happy path
 * Design: e2e/designs/FE-M02-IDENTITY-005-login-companion-happy-path.json
 * Generated: 2026-05-10 | Updated: Loop 2 — page.route() mocks POST /auth/login to bypass
 * backend rate-limiting (429) while still exercising full frontend login → session → nav flow.
 * DO NOT edit production code from this file.
 *
 * PRE-CONDITIONS:
 *  - localStorage 'onboarding_complete' = 'true' is injected so the
 *    (companion)/_layout.tsx guard skips the onboarding redirect.
 */
import { test, expect } from '@playwright/test';
import { resolveWebPath } from './shared/test-helpers';

const BASE_URL = 'http://localhost:8082';

const MOCK_COMPANION_EMAIL = 'fe-m02-id005-companion@example.com';
const MOCK_COMPANION_PASSWORD = 'Password123!';

test.describe('FE-M02-IDENTITY-005: Login — COMPANION happy path', () => {
  test('valid COMPANION credentials navigate to /(companion)/home', async ({ page }) => {
    // ── Mock POST /auth/login → 200 COMPANION success ─────────────────────
    await page.route('**/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'fake-jwt-companion-token-id005',
            tokenType: 'Bearer',
            expiresInSeconds: 3600,
            user: {
              id: 'fake-companion-id-005',
              role: 'COMPANION',
              name: 'Companion Login Test',
              nickname: 'CompLogin005',
              email: MOCK_COMPANION_EMAIL,
              emailVerified: true,
              biometricAuthEnabled: false,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // ── Mock GET /users/me → 200 COMPANION (prevents SessionRestore from calling real backend) ──
    await page.route('**/users/me', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'fake-companion-id-005',
            role: 'COMPANION',
            name: 'Companion Login Test',
            nickname: 'CompLogin005',
            email: MOCK_COMPANION_EMAIL,
            emailVerified: true,
            biometricAuthEnabled: false,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Inject onboarding_complete so layout guard does NOT redirect to onboarding
    await page.addInitScript(() => {
      localStorage.setItem('onboarding_complete', 'true');
    });

    // ── Step 1: openApp /(auth)/login ────────────────────────────────────
    await page.goto(`${BASE_URL}${resolveWebPath('/(auth)/login')}`);
    await page.waitForLoadState('domcontentloaded');

    // ── Step 2: waitForText "Login" + A1: uiVisible ───────────────────────
    await expect(page.getByText('Login')).toBeVisible({ timeout: 10000 });

    // ── Steps 3–4: fill email and password ────────────────────────────────
    await page.getByPlaceholder('Email').fill(MOCK_COMPANION_EMAIL);
    await page.getByPlaceholder('Password').fill(MOCK_COMPANION_PASSWORD);

    // ── Set up network capture BEFORE click (A2, A3) ──────────────────────
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/auth/login') && req.method() === 'POST'
    );
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/auth/login') && res.request().method() === 'POST'
    );

    // ── Step 5: click "Log In" button ─────────────────────────────────────
    await page.getByRole('button', { name: 'Log In' }).click();

    // A2: networkRequestObserved POST /auth/login
    const request = await requestPromise;
    expect(request.url()).toContain('/auth/login');
    expect(request.method()).toBe('POST');

    // ── Step 6: waitForNetworkIdle ────────────────────────────────────────
    await page.waitForLoadState('networkidle');

    // A3: networkResponseObserved POST /auth/login 200
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // ── Step 7: waitForRoute /(companion)/home (web: /home) ───────────────
    await expect(page).toHaveURL(new RegExp('/home'), { timeout: 12000 });

    // A4: routeContains /home
    expect(page.url()).toContain('/home');

    // A5: uiVisible "Companion Home — Milestone 2"
    await expect(page.getByText('Companion Home — Milestone 2')).toBeVisible({ timeout: 8000 });
  });
});
