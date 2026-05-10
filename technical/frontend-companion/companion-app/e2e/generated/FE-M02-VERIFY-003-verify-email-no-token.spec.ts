/**
 * FE-M02-VERIFY-003 — Verify email with no token
 * Design: e2e/designs/FE-M02-VERIFY-003-verify-email-no-token.json
 * Generated: 2026-05-10 | DO NOT edit production code from this file.
 *
 * No backend required: navigate to /verify-email without any token query param.
 * The component immediately shows 'Invalid or missing verification link.'
 * without making an API call.
 */
import { test, expect } from '@playwright/test';
import { resolveWebPath } from './shared/test-helpers';

const BASE_URL = 'http://localhost:8082';

test.describe('FE-M02-VERIFY-003: Verify email — no token', () => {
  test('shows "Invalid or missing verification link." and Go to Login button', async ({ page }) => {
    // ── Step 1: openApp /(auth)/verify-email (no token param) ─────────────
    await page.goto(`${BASE_URL}${resolveWebPath('/(auth)/verify-email')}`);
    await page.waitForLoadState('domcontentloaded');

    // ── Step 2: waitForText "Invalid or missing verification link." ────────
    await expect(
      page.getByText('Invalid or missing verification link.')
    ).toBeVisible({ timeout: 10000 });

    // A1: uiVisible "Invalid or missing verification link."
    // A2: uiVisible "Go to Login"
    await expect(page.getByRole('button', { name: 'Go to Login' })).toBeVisible();

    // A3: uiNotVisible "Verifying your email..." (no loading state — no token)
    await expect(page.getByText('Verifying your email...')).not.toBeVisible();

    // A4: uiNotVisible Email input (no resend form shown for no-token case)
    await expect(page.getByPlaceholder('Email')).not.toBeVisible();

    // ── Step 3: click "Go to Login" ───────────────────────────────────────
    await page.getByRole('button', { name: 'Go to Login' }).click();

    // ── Step 4: waitForRoute /(auth)/login (web: /login) ──────────────────
    await expect(page).toHaveURL(new RegExp('/login'), { timeout: 10000 });

    // A5: routeContains /login
    expect(page.url()).toContain('/login');
  });
});
