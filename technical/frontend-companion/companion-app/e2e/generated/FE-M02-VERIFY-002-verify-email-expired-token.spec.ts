/**
 * FE-M02-VERIFY-002 — Verify email with expired token
 * Design: e2e/designs/FE-M02-VERIFY-002-verify-email-expired-token.json
 * Generated: 2026-05-10 | Updated: Loop 2 — uses page.route() mock; no Mailpit dependency.
 * DO NOT edit production code from this file.
 *
 * Strategy:
 *  - page.route() intercepts GET /auth/verify-email* → returns 400 TOKEN_EXPIRED (deterministic)
 *  - page.route() intercepts POST /auth/resend-verification* → returns 200 success (deterministic)
 *  - No Mailpit lookups or real expired tokens needed.
 */
import { test, expect } from '@playwright/test';
import { resolveWebPath } from './shared/test-helpers';

const BASE_URL = 'http://localhost:8082';
const FAKE_EXPIRED_TOKEN = 'fake-expired-token-verify002';
const RESEND_EMAIL = 'user-needing-resend@example.com';

test.describe('FE-M02-VERIFY-002: Verify email — expired token', () => {
  test('expired token shows expired state, resend email, tap Resend → success', async ({ page }) => {
    // ── Mock GET /auth/verify-email* → 400 TOKEN_EXPIRED ─────────────────
    await page.route('**/auth/verify-email*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'TOKEN_EXPIRED', message: 'Token has expired', statusCode: 400 }),
        });
      } else {
        await route.continue();
      }
    });

    // ── Mock POST /auth/resend-verification* → 200 success ───────────────
    await page.route('**/auth/resend-verification*', async (route) => {
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

    // ── Step 1: openApp /(auth)/verify-email?token=<expired_token> ────────
    const verifyUrl = `${BASE_URL}${resolveWebPath('/(auth)/verify-email')}?token=${encodeURIComponent(FAKE_EXPIRED_TOKEN)}`;

    // Capture the (mocked) verify-email response for assertion A1
    const verifyResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/auth/verify-email') && res.request().method() === 'GET'
    );

    await page.goto(verifyUrl);
    await page.waitForLoadState('domcontentloaded');

    // ── Step 2: waitForNetworkIdle ────────────────────────────────────────
    await page.waitForLoadState('networkidle');

    // A1: networkResponseObserved GET /auth/verify-email (TOKEN_EXPIRED — 400)
    const verifyResponse = await verifyResponsePromise;
    expect(verifyResponse.status()).toBe(400);

    // ── Step 3: waitForText "This verification link has expired." ──────────
    await expect(
      page.getByText('This verification link has expired.')
    ).toBeVisible({ timeout: 10000 });

    // A2: uiVisible "This verification link has expired."
    // A3: uiVisible "Enter your email address to receive a new verification link."
    await expect(
      page.getByText('Enter your email address to receive a new verification link.')
    ).toBeVisible();

    // A4: uiVisible Email input (placeholder "Email")
    await expect(page.getByPlaceholder('Email')).toBeVisible();

    // A5: uiVisible "Resend Verification Email" button
    await expect(page.getByRole('button', { name: 'Resend Verification Email' })).toBeVisible();

    // A6: uiVisible "Back to Login"
    await expect(page.getByText('Back to Login')).toBeVisible();

    // ── Step 4: fill email ─────────────────────────────────────────────────
    await page.getByPlaceholder('Email').fill(RESEND_EMAIL);

    // ── Capture resend request/response BEFORE click ──────────────────────
    const resendRequestPromise = page.waitForRequest(
      (req) => req.url().includes('/auth/resend-verification') && req.method() === 'POST'
    );
    const resendResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/auth/resend-verification') && res.request().method() === 'POST'
    );

    // ── Step 5: click "Resend Verification Email" ─────────────────────────
    await page.getByRole('button', { name: 'Resend Verification Email' }).click();

    // A7: networkRequestObserved POST /auth/resend-verification
    const resendRequest = await resendRequestPromise;
    expect(resendRequest.url()).toContain('/auth/resend-verification');

    // ── Step 6: waitForNetworkIdle ────────────────────────────────────────
    await page.waitForLoadState('networkidle');

    // A8: networkResponseObserved POST /auth/resend-verification 200
    const resendResponse = await resendResponsePromise;
    expect(resendResponse.status()).toBe(200);

    // A9: uiVisible "Verification email sent. Check your inbox."
    await expect(
      page.getByText('Verification email sent. Check your inbox.')
    ).toBeVisible({ timeout: 8000 });
  });
});
