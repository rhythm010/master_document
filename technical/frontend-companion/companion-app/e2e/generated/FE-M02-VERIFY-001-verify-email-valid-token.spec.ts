/**
 * FE-M02-VERIFY-001 — Verify email with valid token
 * Design: e2e/designs/FE-M02-VERIFY-001-verify-email-valid-token.json
 * Generated: 2026-05-10 | DO NOT edit production code from this file.
 *
 * PRE-CONDITIONS:
 *  - A new account is created in beforeAll.
 *  - The verification token is fetched from Mailpit.
 *  - The app is opened at /verify-email?token=<valid_token>.
 */
import { test, expect } from '@playwright/test';
import { createUser, getVerificationToken, uniqueEmail, resolveWebPath } from './shared/test-helpers';

const BASE_URL = 'http://localhost:8082';

let validToken: string;

test.describe('FE-M02-VERIFY-001: Verify email — valid token', () => {
  test.beforeAll(async () => {
    const email = uniqueEmail('fe-m02-verify001');
    await createUser({
      email,
      password: 'Password123!',
      role: 'CLIENT',
      name: 'Verify Test User',
      nickname: 'VerifyTest001',
    });
    // Get the verification token from Mailpit WITHOUT calling verify-email,
    // so the token is still valid when the UI test uses it.
    validToken = await getVerificationToken(email);
  });

  test('loading state → Email verified! → Go to Login → navigates to login', async ({ page }) => {
    // ── Step 1: openApp /(auth)/verify-email?token=<valid_token> ──────────
    const verifyUrl = `${BASE_URL}${resolveWebPath('/(auth)/verify-email')}?token=${encodeURIComponent(validToken)}`;

    // Set up network capture BEFORE navigating (verifyEmail fires immediately on mount)
    const verifyResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/auth/verify-email') && res.request().method() === 'GET'
    );

    await page.goto(verifyUrl);
    await page.waitForLoadState('domcontentloaded');

    // ── Step 3: waitForNetworkIdle ────────────────────────────────────────
    await page.waitForLoadState('networkidle');

    // A2: networkRequestObserved GET /auth/verify-email (request already fired on load)
    // A3: networkResponseObserved GET /auth/verify-email
    const verifyResponse = await verifyResponsePromise;
    expect(verifyResponse.status()).toBe(200);

    // ── Step 4: waitForText "Email verified! You can now log in." + A4, A5 ─
    await expect(
      page.getByText('Email verified! You can now log in.')
    ).toBeVisible({ timeout: 10000 });

    // A4: uiVisible "Email verified! You can now log in."
    // A5: uiVisible "Go to Login"
    await expect(page.getByRole('button', { name: 'Go to Login' })).toBeVisible();

    // ── Step 5: click "Go to Login" ───────────────────────────────────────
    await page.getByRole('button', { name: 'Go to Login' }).click();

    // ── Step 6: waitForRoute /(auth)/login (web: /login) ──────────────────
    await expect(page).toHaveURL(new RegExp('/login'), { timeout: 10000 });

    // A6: routeContains /login
    expect(page.url()).toContain('/login');
  });
});
