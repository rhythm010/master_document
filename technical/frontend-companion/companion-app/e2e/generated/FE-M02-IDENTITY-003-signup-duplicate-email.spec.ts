/**
 * FE-M02-IDENTITY-003 — Signup duplicate email shows inline error
 * Design: e2e/designs/FE-M02-IDENTITY-003-signup-duplicate-email.json
 * Generated: 2026-05-10 | DO NOT edit production code from this file.
 *
 * PRE-CONDITION: An account with existingEmail must exist in the DB before this test.
 * This spec creates the existing account via API in beforeAll.
 */
import { test, expect, type Page } from '@playwright/test';
import { createUser, uniqueEmail, resolveWebPath } from './shared/test-helpers';

const BASE_URL = 'http://localhost:8082';

let existingEmail: string;

test.describe('FE-M02-IDENTITY-003: Signup — duplicate email error', () => {
  test.beforeAll(async () => {
    // Create the "existing" account via API so duplicate check will trigger
    existingEmail = uniqueEmail('fe-m02-id003-existing');
    await createUser({
      email: existingEmail,
      password: 'Password123!',
      role: 'CLIENT',
      name: 'Duplicate User',
      nickname: 'DupUser',
    });
  });

  test('shows inline error "An account with this email already exists."', async ({ page }) => {
    // ── Step 1: openApp — navigate to / and let SessionRestore redirect to /login ──
    // Direct navigation to /signup is intercepted by SessionRestore (index.tsx redirect).
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Login')).toBeVisible({ timeout: 10000 });
    await page.getByText(/sign up/i).click();

    // ── Step 2: waitForText "Create Account" + A1: uiVisible ──────────────
    // BUG-A fix: Use .first() — the heading is a generic <div>, not a semantic heading.
    // getByRole('heading') returns 0 elements; getByText matches both title + button.
    await expect(page.getByText('Create Account').first()).toBeVisible({ timeout: 10000 });

    // ── Steps 3–6: fill form with EXISTING email ───────────────────────────
    await page.getByPlaceholder('Full Name').fill('Duplicate User');
    await page.getByPlaceholder('Nickname').fill('DupUser');
    await page.getByPlaceholder('Email').fill(existingEmail);
    await page.getByPlaceholder('Password').fill('Password123!');

    // ── Set up network capture BEFORE click (A2, A3) ──────────────────────
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/auth/signup') && req.method() === 'POST'
    );
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/auth/signup') && res.request().method() === 'POST'
    );

    // ── Step 7: click "Create Account" button ─────────────────────────────
    await page.getByRole('button', { name: 'Create Account' }).click();

    // A2: networkRequestObserved POST /auth/signup
    const request = await requestPromise;
    expect(request.url()).toContain('/auth/signup');
    expect(request.method()).toBe('POST');

    // ── Step 8: waitForNetworkIdle ─────────────────────────────────────────
    await page.waitForLoadState('networkidle');

    // A3: networkResponseObserved POST /auth/signup (409 or error status)
    const response = await responsePromise;
    expect(response.status()).not.toBe(201); // Should be an error status

    // A4: uiVisible "An account with this email already exists."
    await expect(
      page.getByText('An account with this email already exists.')
    ).toBeVisible({ timeout: 8000 });

    // A5: routeContains /(auth)/signup (web: /signup) — stayed on signup page
    expect(page.url()).toContain('/signup');
  });
});
