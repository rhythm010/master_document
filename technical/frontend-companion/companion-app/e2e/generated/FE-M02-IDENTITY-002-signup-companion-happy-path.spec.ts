/**
 * FE-M02-IDENTITY-002 — Signup COMPANION happy path
 * Design: e2e/designs/FE-M02-IDENTITY-002-signup-companion-happy-path.json
 * Generated: 2026-05-10 | DO NOT edit production code from this file.
 */
import { test, expect } from '@playwright/test';
import { uniqueEmail, resolveWebPath } from './shared/test-helpers';

const BASE_URL = 'http://localhost:8082';

test.describe('FE-M02-IDENTITY-002: Signup — COMPANION happy path', () => {
  test('select COMPANION role, fill fields, submit, dismiss alert, navigate to login', async ({ page }) => {
    const email = uniqueEmail('fe-m02-id002-companion');
    const name = 'Test Companion User';
    const nickname = 'TestCompanion';
    const password = 'Password123!';

    // ── Step 1: openApp — navigate to / and let SessionRestore redirect to /login ──
    // Direct navigation to /signup is intercepted by SessionRestore (index.tsx redirect).
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Login')).toBeVisible({ timeout: 10000 });
    await page.getByText(/sign up/i).click();

    // ── Step 2: waitForText "Create Account" + Assertion A1 ─────────────────
    // BUG-A fix: Use .first() — the heading is a generic <div>, not a semantic heading.
    // getByRole('heading') returns 0 elements; getByText matches both title + button.
    await expect(page.getByText('Create Account').first()).toBeVisible({ timeout: 10000 });

    // ── Step 3: click "Companion" + Assertion A2 ────────────────────────────
    await page.getByText('Companion').click();
    await expect(page.getByText('Companion')).toBeVisible();

    // ── Steps 4–7: fill form fields ─────────────────────────────────────────
    await page.getByPlaceholder('Full Name').fill(name);
    await page.getByPlaceholder('Nickname').fill(nickname);
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);

    // ── Set up network capture BEFORE click (A3, A4) ────────────────────────
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/auth/signup') && req.method() === 'POST'
    );
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/auth/signup') && res.request().method() === 'POST'
    );

    // ── Dialog handler for window.alert ─────────────────────────────────────
    page.once('dialog', (dialog) => dialog.accept());

    // ── Step 8: click "Create Account" button ───────────────────────────────
    await page.getByRole('button', { name: 'Create Account' }).click();

    // A3: networkRequestObserved POST /auth/signup
    const request = await requestPromise;
    expect(request.url()).toContain('/auth/signup');
    expect(request.method()).toBe('POST');

    // ── Step 9: waitForNetworkIdle ───────────────────────────────────────────
    await page.waitForLoadState('networkidle');

    // A4: networkResponseObserved POST /auth/signup 201
    const response = await responsePromise;
    expect(response.status()).toBe(201);

    // ── Step 10: pressKey Enter — already dismissed by dialog handler ────────

    // ── Step 11: waitForRoute /(auth)/login ──────────────────────────────────
    await expect(page).toHaveURL(new RegExp('/login'), { timeout: 10000 });

    // A5: routeContains /login
    expect(page.url()).toContain('/login');

    // A6: uiVisible "Login"
    await expect(page.getByText('Login')).toBeVisible({ timeout: 8000 });
  });
});
