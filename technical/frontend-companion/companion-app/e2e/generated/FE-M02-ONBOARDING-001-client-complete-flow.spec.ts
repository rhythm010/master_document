/**
 * FE-M02-ONBOARDING-001 — CLIENT complete onboarding flow
 * Design: e2e/designs/FE-M02-ONBOARDING-001-client-complete-flow.json
 * Generated: 2026-05-10 | Updated: Loop 2 — page.route() mocks POST /auth/login to bypass
 * backend rate-limiting (429) while still exercising the full onboarding redirect flow.
 * DO NOT edit production code from this file.
 *
 * PRE-CONDITIONS:
 *  - localStorage does NOT contain 'onboarding_complete' (fresh context = default).
 *    The (client)/_layout.tsx guard will redirect to /(client)/onboarding.
 */
import { test, expect } from '@playwright/test';
import { resolveWebPath } from './shared/test-helpers';

const BASE_URL = 'http://localhost:8082';

const MOCK_CLIENT_EMAIL = 'fe-m02-onb001-client@example.com';
const MOCK_CLIENT_PASSWORD = 'Password123!';

test.describe('FE-M02-ONBOARDING-001: Onboarding — CLIENT complete flow', () => {
  test('3 slides, Back hidden on slide 1, Get Started on last slide, navigate to home, reload keeps home', async ({
    page,
  }) => {
    // ── Mock POST /auth/login → 200 CLIENT success ────────────────────────
    await page.route('**/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'fake-jwt-client-token-onb001',
            tokenType: 'Bearer',
            expiresInSeconds: 3600,
            user: {
              id: 'fake-client-id-onb001',
              role: 'CLIENT',
              name: 'Onboarding Client Test',
              nickname: 'OnbClient001',
              email: MOCK_CLIENT_EMAIL,
              emailVerified: true,
              biometricAuthEnabled: false,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // ── Mock GET /users/me → 200 CLIENT (prevents SessionRestore 401 on login + after reload) ──
    await page.route('**/users/me', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'fake-client-id-onb001',
            role: 'CLIENT',
            name: 'Onboarding Client Test',
            nickname: 'OnbClient001',
            email: MOCK_CLIENT_EMAIL,
            emailVerified: true,
            biometricAuthEnabled: false,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Fresh context: NO onboarding_complete in localStorage — layout will redirect
    // ── Step 1: openApp /(auth)/login ────────────────────────────────────
    await page.goto(`${BASE_URL}${resolveWebPath('/(auth)/login')}`);
    await page.waitForLoadState('domcontentloaded');

    // ── Steps 2–3: fill credentials ───────────────────────────────────────
    await page.getByPlaceholder('Email').fill(MOCK_CLIENT_EMAIL);
    await page.getByPlaceholder('Password').fill(MOCK_CLIENT_PASSWORD);

    // ── Step 4: click "Log In" ────────────────────────────────────────────
    await page.getByRole('button', { name: 'Log In' }).click();

    // ── Step 5: waitForRoute /(client)/onboarding (web: /onboarding) ──────
    // Layout guard detects no onboarding_complete → redirects to /onboarding
    await expect(page).toHaveURL(new RegExp('/onboarding'), { timeout: 12000 });

    // A1: routeContains /onboarding
    expect(page.url()).toContain('/onboarding');

    // ── Step 6: waitForText "Welcome to Companion" ────────────────────────
    await expect(page.getByText('Welcome to Companion')).toBeVisible({ timeout: 8000 });

    // A2: uiVisible "Welcome to Companion"
    // A3: uiNotVisible "Back" (Back button only appears on slides 2+)
    await expect(page.getByText('Back')).not.toBeVisible();

    // A4: uiVisible subtitle of slide 1
    await expect(
      page.getByText('Your trusted companion experience starts here.')
    ).toBeVisible();

    // ── Step 7: waitForText "Next" ────────────────────────────────────────
    await expect(page.getByText('Next')).toBeVisible();

    // ── Step 8: click "Next" → slide 2 ────────────────────────────────────
    await page.getByText('Next').click();

    // ── Step 9: waitForText "Find Your Companion" ─────────────────────────
    await expect(page.getByText('Find Your Companion')).toBeVisible({ timeout: 5000 });

    // A5: uiVisible "Find Your Companion"
    // A6: uiVisible "Back" (now on slide 2)
    await expect(page.getByText('Back')).toBeVisible();

    // ── Step 10: click "Back" → slide 1 ──────────────────────────────────
    await page.getByText('Back').click();

    // ── Step 11: waitForText "Welcome to Companion" (back on slide 1) ─────
    await expect(page.getByText('Welcome to Companion')).toBeVisible({ timeout: 5000 });

    // ── Step 12: click "Next" → slide 2 ──────────────────────────────────
    await page.getByText('Next').click();

    // ── Step 13: click "Next" → slide 3 ──────────────────────────────────
    await page.getByText('Next').click();

    // ── Step 14: waitForText "Ready to Begin" (slide 3) ──────────────────
    await expect(page.getByText('Ready to Begin')).toBeVisible({ timeout: 5000 });

    // A7: uiVisible "Ready to Begin"
    // A8: uiVisible "Get Started" (last slide shows Get Started instead of Next)
    await expect(page.getByText('Get Started')).toBeVisible();

    // A9: uiNotVisible "Next" (replaced by Get Started on last slide)
    await expect(page.getByText('Next')).not.toBeVisible();

    // ── Step 15: click "Get Started" ─────────────────────────────────────
    await page.getByText('Get Started').click();

    // ── Step 16: waitForRoute /(client)/home (web: /home) ─────────────────
    await expect(page).toHaveURL(new RegExp('/home'), { timeout: 10000 });

    // A10: routeContains /home
    expect(page.url()).toContain('/home');

    // A11: uiVisible "Client Home — Milestone 2"
    await expect(page.getByText('Client Home — Milestone 2')).toBeVisible({ timeout: 8000 });

    // ── Step 17: reload ───────────────────────────────────────────────────
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // ── Step 18: waitForRoute /(client)/home — still on home after reload ─
    await expect(page).toHaveURL(new RegExp('/home'), { timeout: 12000 });

    // A12: routeContains /home (onboarding is not re-shown after completion)
    expect(page.url()).toContain('/home');
  });
});
