/**
 * FE-M02-ONBOARDING-002 — COMPANION complete onboarding flow
 * Design: e2e/designs/FE-M02-ONBOARDING-002-companion-complete-flow.json
 * Generated: 2026-05-10 | Updated: Loop 3 — removed page.goto('/onboarding') (caused full page
 * reload resetting Zustand session store → companion layout saw user:null → redirected to login).
 * Now waits for auto-redirect to /onboarding after login click, mirroring ONBOARDING-001 strategy.
 * DO NOT edit production code from this file.
 *
 * PRE-CONDITIONS:
 *  - localStorage does NOT contain 'onboarding_complete'.
 *    After login, (companion)/_layout.tsx redirects to /(companion)/onboarding.
 */
import { test, expect } from '@playwright/test';
import { resolveWebPath } from './shared/test-helpers';

const BASE_URL = 'http://localhost:8082';

const MOCK_COMPANION_EMAIL = 'fe-m02-onb002-companion@example.com';
const MOCK_COMPANION_PASSWORD = 'Password123!';

test.describe('FE-M02-ONBOARDING-002: Onboarding — COMPANION complete flow', () => {
  test('3 slides, Back hidden on slide 1, Get Started on last slide, navigate to companion home', async ({
    page,
  }) => {
    // ── Mock POST /auth/login → 200 COMPANION success ─────────────────────
    await page.route('**/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'fake-jwt-companion-token-onb002',
            tokenType: 'Bearer',
            expiresInSeconds: 3600,
            user: {
              id: 'fake-companion-id-onb002',
              role: 'COMPANION',
              name: 'Onboarding Companion Test',
              nickname: 'OnbComp002',
              email: MOCK_COMPANION_EMAIL,
              emailVerified: true,
              biometricAuthEnabled: false,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // ── Mock GET /users/me → 200 COMPANION (prevents SessionRestore 401 on all navigations) ──
    await page.route('**/users/me', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'fake-companion-id-onb002',
            role: 'COMPANION',
            name: 'Onboarding Companion Test',
            nickname: 'OnbComp002',
            email: MOCK_COMPANION_EMAIL,
            emailVerified: true,
            biometricAuthEnabled: false,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Fresh context: NO onboarding_complete — layout will redirect to onboarding

    // ── Step 1: openApp /(auth)/login ────────────────────────────────────
    await page.goto(`${BASE_URL}${resolveWebPath('/(auth)/login')}`);
    await page.waitForLoadState('domcontentloaded');

    // ── Steps 2–3: fill credentials ───────────────────────────────────────
    await page.getByPlaceholder('Email').fill(MOCK_COMPANION_EMAIL);
    await page.getByPlaceholder('Password').fill(MOCK_COMPANION_PASSWORD);

    // ── Step 4: click "Log In" ────────────────────────────────────────────
    await page.getByRole('button', { name: 'Log In' }).click();

    // ── Step 5: waitForRoute /(companion)/onboarding ─────────────────────
    // Login screen calls router.replace('/(companion)/home').
    // Companion layout sees onboarding_complete=absent → auto-redirects to /onboarding.
    // Wait for that auto-redirect (do NOT use page.goto — it resets the session store).
    await expect(page).toHaveURL(new RegExp('/onboarding'), { timeout: 12000 });

    // ── Step 7: waitForText "Welcome to Companion" ────────────────────────
    await expect(page.getByText('Welcome to Companion')).toBeVisible({ timeout: 10000 });

    // A1: uiVisible "Welcome to Companion"
    // A2: uiNotVisible "Back" (Back hidden on slide 1)
    await expect(page.getByText('Back')).not.toBeVisible();

    // A3: uiVisible subtitle of slide 1
    await expect(
      page.getByText('Your trusted companion experience starts here.')
    ).toBeVisible();

    // ── Step 8: click "Next" → slide 2 ────────────────────────────────────
    await page.getByText('Next').click();

    // ── Step 9: waitForText "Be a Great Companion" ────────────────────────
    await expect(page.getByText('Be a Great Companion')).toBeVisible({ timeout: 5000 });

    // A4: uiVisible "Be a Great Companion"
    // A5: uiVisible "Back"
    await expect(page.getByText('Back')).toBeVisible();

    // ── Step 10: click "Next" → slide 3 ──────────────────────────────────
    await page.getByText('Next').click();

    // ── Step 11: waitForText "Ready to Begin" ────────────────────────────
    await expect(page.getByText('Ready to Begin')).toBeVisible({ timeout: 5000 });

    // A6: uiVisible "Ready to Begin"
    // A7: uiVisible "Get Started"
    await expect(page.getByText('Get Started')).toBeVisible();

    // A8: uiVisible "Complete your profile and start accepting bookings."
    await expect(
      page.getByText('Complete your profile and start accepting bookings.')
    ).toBeVisible();

    // ── Step 12: click "Get Started" ─────────────────────────────────────
    await page.getByText('Get Started').click();

    // ── Step 13: waitForRoute /(companion)/home (web: /home) ──────────────
    await expect(page).toHaveURL(new RegExp('/home'), { timeout: 10000 });

    // A9: routeContains /home
    expect(page.url()).toContain('/home');

    // A10: uiVisible "Companion Home — Milestone 2"
    await expect(page.getByText('Companion Home — Milestone 2')).toBeVisible({ timeout: 8000 });
  });
});
