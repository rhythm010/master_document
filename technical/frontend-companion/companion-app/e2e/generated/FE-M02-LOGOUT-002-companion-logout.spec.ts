/**
 * FE-M02-LOGOUT-002 — COMPANION logout
 * Design: e2e/designs/FE-M02-LOGOUT-002-companion-logout.json
 * Generated: 2026-05-10 | Updated: Loop 2 — page.route() mocks POST /auth/login to bypass
 * backend rate-limiting (429) while still exercising session storage and logout flow.
 * DO NOT edit production code from this file.
 *
 * PRE-CONDITIONS:
 *  - onboarding_complete injected via addInitScript.
 */
import { test, expect } from '@playwright/test';
import { resolveWebPath, assertNoAuthToken } from './shared/test-helpers';

const BASE_URL = 'http://localhost:8082';

const MOCK_COMPANION_EMAIL = 'fe-m02-logout002-companion@example.com';
const MOCK_COMPANION_PASSWORD = 'Password123!';

test.describe('FE-M02-LOGOUT-002: Logout — COMPANION', () => {
  test('tap Logout on companion home navigates to /(auth)/login and clears session', async ({ page }) => {
    // ── Mock POST /auth/login → 200 COMPANION success ─────────────────────
    await page.route('**/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'fake-jwt-companion-token-logout002',
            tokenType: 'Bearer',
            expiresInSeconds: 3600,
            user: {
              id: 'fake-companion-id-logout002',
              role: 'COMPANION',
              name: 'Logout Companion Test',
              nickname: 'LogoutComp002',
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
            id: 'fake-companion-id-logout002',
            role: 'COMPANION',
            name: 'Logout Companion Test',
            nickname: 'LogoutComp002',
            email: MOCK_COMPANION_EMAIL,
            emailVerified: true,
            biometricAuthEnabled: false,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Inject onboarding_complete so layout guard does NOT redirect to onboarding after login
    await page.addInitScript(() => {
      localStorage.setItem('onboarding_complete', 'true');
    });

    // ── Step 1: openApp /(auth)/login ────────────────────────────────────
    await page.goto(`${BASE_URL}${resolveWebPath('/(auth)/login')}`);
    await page.waitForLoadState('domcontentloaded');

    // ── Steps 2–3: fill email and password ────────────────────────────────
    await page.getByPlaceholder('Email').fill(MOCK_COMPANION_EMAIL);
    await page.getByPlaceholder('Password').fill(MOCK_COMPANION_PASSWORD);

    // ── Step 4: click "Log In" ────────────────────────────────────────────
    await page.getByRole('button', { name: 'Log In' }).click();

    // ── Step 5: waitForRoute /(companion)/home (web: /home) ───────────────
    await expect(page).toHaveURL(new RegExp('/home'), { timeout: 12000 });

    // ── Step 6: waitForText "Companion Home — Milestone 2" ────────────────
    await expect(page.getByText('Companion Home — Milestone 2')).toBeVisible({ timeout: 8000 });

    // A1: uiVisible "Companion Home — Milestone 2"
    // A2: uiVisible "Logout"
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

    // ── Step 7: click "Logout" button ─────────────────────────────────────
    await page.getByRole('button', { name: 'Logout' }).click();

    // ── Step 8: waitForRoute /(auth)/login (web: /login) ──────────────────
    await expect(page).toHaveURL(new RegExp('/login'), { timeout: 10000 });

    // A3: routeContains /login
    expect(page.url()).toContain('/login');

    // A4: uiVisible "Login"
    await expect(page.getByText('Login')).toBeVisible({ timeout: 8000 });

    // A5: storageValueAbsent — auth token cleared
    const tokenAbsent = await assertNoAuthToken(page);
    expect(tokenAbsent).toBe(true);
  });
});
