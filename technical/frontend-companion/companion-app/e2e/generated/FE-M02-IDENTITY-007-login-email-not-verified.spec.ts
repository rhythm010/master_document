/**
 * FE-M02-IDENTITY-007 — Login EMAIL_NOT_VERIFIED
 * Design: e2e/designs/FE-M02-IDENTITY-007-login-email-not-verified.json
 * Generated: 2026-05-10 | Updated: Loop 2 — page.route() mocks POST /auth/login → 403
 * EMAIL_NOT_VERIFIED and POST /auth/resend-verification → 200 to bypass rate-limiting.
 * DO NOT edit production code from this file.
 */
import { test, expect } from '@playwright/test';
import { resolveWebPath } from './shared/test-helpers';

const BASE_URL = 'http://localhost:8082';

const MOCK_UNVERIFIED_EMAIL = 'fe-m02-id007-unverified@example.com';
const MOCK_PASSWORD = 'Password123!';

test.describe('FE-M02-IDENTITY-007: Login — EMAIL_NOT_VERIFIED', () => {
  test('shows error, Resend button visible, tap Resend → success message', async ({ page }) => {
    // ── Mock POST /auth/login → 403 EMAIL_NOT_VERIFIED ────────────────────
    await page.route('**/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' }),
        });
      } else {
        await route.continue();
      }
    });

    // ── Mock POST /auth/resend-verification → 200 success ─────────────────
    await page.route('**/auth/resend-verification', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Verification email sent successfully.' }),
        });
      } else {
        await route.continue();
      }
    });

    // ── Step 1: openApp /(auth)/login ────────────────────────────────────
    await page.goto(`${BASE_URL}${resolveWebPath('/(auth)/login')}`);
    await page.waitForLoadState('domcontentloaded');

    // ── Step 2: waitForText "Login" ───────────────────────────────────────
    await expect(page.getByText('Login')).toBeVisible({ timeout: 10000 });

    // ── Steps 3–4: fill credentials ───────────────────────────────────────
    await page.getByPlaceholder('Email').fill(MOCK_UNVERIFIED_EMAIL);
    await page.getByPlaceholder('Password').fill(MOCK_PASSWORD);

    // ── Set up network capture BEFORE click ───────────────────────────────
    const loginRequestPromise = page.waitForRequest(
      (req) => req.url().includes('/auth/login') && req.method() === 'POST'
    );
    const loginResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/auth/login') && res.request().method() === 'POST'
    );

    // ── Step 5: click "Log In" ────────────────────────────────────────────
    await page.getByRole('button', { name: 'Log In' }).click();
    await loginRequestPromise;

    // ── Step 6: waitForNetworkIdle ────────────────────────────────────────
    await page.waitForLoadState('networkidle');
    await loginResponsePromise;

    // A1: uiVisible "Please verify your email before logging in."
    await expect(
      page.getByText('Please verify your email before logging in.')
    ).toBeVisible({ timeout: 8000 });

    // ── Step 7: waitForText "Resend Verification Email" ───────────────────
    await expect(page.getByText('Resend Verification Email')).toBeVisible({ timeout: 8000 });

    // A2: uiVisible "Resend Verification Email"
    // A3: routeContains /login — stayed on login page
    expect(page.url()).toContain('/login');

    // ── Set up network capture for resend BEFORE click (A4, A5) ──────────
    const resendRequestPromise = page.waitForRequest(
      (req) => req.url().includes('/auth/resend-verification') && req.method() === 'POST'
    );
    const resendResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/auth/resend-verification') && res.request().method() === 'POST'
    );

    // ── Step 8: click "Resend Verification Email" ─────────────────────────
    await page.getByText('Resend Verification Email').click();

    // A4: networkRequestObserved POST /auth/resend-verification
    const resendRequest = await resendRequestPromise;
    expect(resendRequest.url()).toContain('/auth/resend-verification');

    // ── Step 9: waitForNetworkIdle ────────────────────────────────────────
    await page.waitForLoadState('networkidle');

    // A5: networkResponseObserved POST /auth/resend-verification 200
    const resendResponse = await resendResponsePromise;
    expect(resendResponse.status()).toBe(200);

    // A6: uiVisible "Verification email sent. Check your inbox."
    await expect(
      page.getByText('Verification email sent. Check your inbox.')
    ).toBeVisible({ timeout: 8000 });
  });
});
