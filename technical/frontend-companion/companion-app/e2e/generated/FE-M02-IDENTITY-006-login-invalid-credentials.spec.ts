/**
 * FE-M02-IDENTITY-006 — Login invalid credentials
 * Design: e2e/designs/FE-M02-IDENTITY-006-login-invalid-credentials.json
 * Generated: 2026-05-10 | Updated: Loop 2 — page.route() mocks POST /auth/login → 401
 * INVALID_CREDENTIALS to bypass backend rate-limiting (429).
 * DO NOT edit production code from this file.
 */
import { test, expect } from '@playwright/test';
import { resolveWebPath } from './shared/test-helpers';

const BASE_URL = 'http://localhost:8082';

test.describe('FE-M02-IDENTITY-006: Login — invalid credentials', () => {
  test('shows inline error "Incorrect email or password." and stays on login', async ({ page }) => {
    const email = 'someone@example.com';
    const wrongPassword = 'definitely-wrong-password-xyz';

    // ── Mock POST /auth/login → 401 INVALID_CREDENTIALS ──────────────────
    await page.route('**/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }),
        });
      } else {
        await route.continue();
      }
    });

    // ── Step 1: openApp /(auth)/login ────────────────────────────────────
    await page.goto(`${BASE_URL}${resolveWebPath('/(auth)/login')}`);
    await page.waitForLoadState('domcontentloaded');

    // ── Step 2: waitForText "Login" + A1: uiVisible ───────────────────────
    await expect(page.getByText('Login')).toBeVisible({ timeout: 10000 });

    // ── Steps 3–4: fill bad credentials ───────────────────────────────────
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(wrongPassword);

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

    // A3: networkResponseObserved POST /auth/login (4xx error)
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(400);

    // A4: uiVisible "Incorrect email or password."
    await expect(
      page.getByText('Incorrect email or password.')
    ).toBeVisible({ timeout: 8000 });

    // A5: uiNotVisible "Resend Verification Email"
    await expect(page.getByText('Resend Verification Email')).not.toBeVisible();

    // A6: routeContains /(auth)/login (web: /login) — stayed on login page
    expect(page.url()).toContain('/login');
  });
});
