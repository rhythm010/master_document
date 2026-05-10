/**
 * GENERATED PLAYWRIGHT SPEC — DO NOT EDIT PRODUCTION CODE FROM THIS FILE
 *
 * Source design: technical/frontend-companion/companion-app/e2e/designs/FE-M01-FOUNDATION-001-no-session-to-login.json
 * Test ID: FE-M01-FOUNDATION-001-no-session-to-login
 * Title: Fresh start with no persisted token redirects to login stub screen
 * Generated: 2026-05-10
 *
 * WARNING: This file is generated from the FE UI test design JSON.
 * To change test behaviour, update the design JSON and regenerate this spec.
 */

import { test, expect, BrowserContext, Page } from '@playwright/test';

test.describe('FE-M01-FOUNDATION-001 — No session → redirects to login', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    // PRE-2: Fresh browser context — no auth_token in localStorage
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test(
    'Fresh start with no persisted token redirects to login stub screen',
    async () => {
      // ──────────────────────────────────────────────────────────────────────
      // STEP 1 — openApp: open the app at the session restore splash
      // ──────────────────────────────────────────────────────────────────────
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // ──────────────────────────────────────────────────────────────────────
      // STEP 2 — waitForRoute: session restore reads no token → redirects to /login
      // ──────────────────────────────────────────────────────────────────────
      await expect(page).toHaveURL(/login/, { timeout: 5000 });

      // ASSERTION 1 (afterStep 2): routeContains "login"
      await expect(page).toHaveURL(/login/,  { timeout: 5000 });
      console.log('[ASSERTION 1] PASS — route contains "login"');

      // ──────────────────────────────────────────────────────────────────────
      // STEP 3 — waitForText: login stub screen renders "Login" text
      // ──────────────────────────────────────────────────────────────────────
      await expect(page.getByText('Login', { exact: false })).toBeVisible({ timeout: 3000 });

      // ASSERTION 2 (afterStep 3): uiVisible — text "Login"
      await expect(page.getByText('Login', { exact: false })).toBeVisible({ timeout: 3000 });
      console.log('[ASSERTION 2] PASS — "Login" text is visible');

      // ASSERTION 3 (afterStep 3): uiNotVisible — "Client Home" must NOT be visible
      await expect(page.getByText('Client Home', { exact: false })).not.toBeVisible();
      console.log('[ASSERTION 3] PASS — "Client Home" not visible');

      // ASSERTION 4 (afterStep 3): uiNotVisible — "Companion Home" must NOT be visible
      await expect(page.getByText('Companion Home', { exact: false })).not.toBeVisible();
      console.log('[ASSERTION 4] PASS — "Companion Home" not visible');
    }
  );
});
