/**
 * FE-M02-IDENTITY-001 — Signup CLIENT happy path
 * Design: e2e/designs/FE-M02-IDENTITY-001-signup-client-happy-path.json
 * Generated: 2026-05-10 | DO NOT edit production code from this file.
 */
import { test, expect } from '@playwright/test';
import { uniqueEmail, resolveWebPath } from './shared/test-helpers';

const BASE_URL = 'http://localhost:8082';

test.describe('FE-M02-IDENTITY-001: Signup — CLIENT happy path', () => {
  test('fill all fields, submit, dismiss alert, navigate to login', async ({ page }) => {
    const email = uniqueEmail('fe-m02-id001-client');
    const name = 'Test Client User';
    const nickname = 'TestClient';
    const password = 'Password123!';

    // ── Step 1: openApp — navigate to / and let SessionRestore redirect to /login ──
    // Direct navigation to /signup is intercepted by SessionRestore (index.tsx redirect).
    // Instead: land on login, then click the sign-up link — the natural user path.
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Login')).toBeVisible({ timeout: 10000 });
    // Navigate to signup via the link (avoids SessionRestore redirect)
    await page.getByText(/sign up/i).click();

    // ── Step 2: waitForText "Create Account" + Assertion A1: uiVisible ──────
    // BUG-A fix: Use .first() to avoid strict-mode clash — the heading is a generic <div>,
    // not a semantic heading element. getByRole('heading') returns 0 elements.
    // getByText('Create Account') returns 2 (the title div + the submit button).
    await expect(page.getByText('Create Account').first()).toBeVisible({ timeout: 10000 });
    // A1: Create Account heading visible ✓

    // ── Step 3: click "Client" + Assertion A2: uiVisible ───────────────────
    await page.getByText('Client').first().click();
    await expect(page.getByText('Client')).toBeVisible();
    // A2: Client role visible ✓

    // ── Steps 4–7: fill form fields ─────────────────────────────────────────
    await page.getByPlaceholder('Full Name').fill(name);
    await page.getByPlaceholder('Nickname').fill(nickname);
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);

    // ── Set up network capture BEFORE click (for assertions A3, A4) ─────────
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/auth/signup') && req.method() === 'POST'
    );
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/auth/signup') && res.request().method() === 'POST'
    );

    // ── Set up dialog handler BEFORE click (Alert.alert → window.alert on web)
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

    // ── Step 10: pressKey Enter (dialog already dismissed by handler above) ──
    // No-op: dialog was dismissed by page.once('dialog', ...) registered above.

    // ── Step 11: waitForRoute /(auth)/login ──────────────────────────────────
    await expect(page).toHaveURL(new RegExp('/login'), { timeout: 10000 });

    // A5: routeContains /(auth)/login (web: /login)
    expect(page.url()).toContain('/login');

    // A6: uiVisible "Login"
    await expect(page.getByText('Login')).toBeVisible({ timeout: 8000 });
  });
});
