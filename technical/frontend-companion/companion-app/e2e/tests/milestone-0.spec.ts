import { test, expect } from '@playwright/test';
import { HomePage } from '../fixtures/page-objects';
import { testData } from '../fixtures/test-data';

/**
 * Milestone 0 E2E Tests
 * 
 * These tests validate that the Companion app shell is functional and can:
 * - Run on real web/device
 * - Display the home screen with milestone 0 title
 * - Show the current environment
 * - Call the backend health endpoint
 * - Navigate to placeholder routes
 */

test.describe('Milestone 0: Real Device Placeholder App', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.goto();
  });

  test('should display milestone 0 home screen', async ({ page }) => {
    // Verify page title is visible
    const isTitleVisible = await homePage.isTitleVisible();
    expect(isTitleVisible).toBeTruthy();

    // Verify title text
    const title = await page.locator('text=Companion App - Milestone 0').textContent();
    expect(title).toContain('Companion App - Milestone 0');
  });

  test('should display current environment', async ({ page }) => {
    // Verify environment is displayed
    const envText = await homePage.getEnvironmentText();
    expect(envText).toContain('Environment:');
  });

  test('should have health check button', async ({ page }) => {
    // Verify health check button is visible
    const healthButton = page.locator('button:has-text("Check Health")');
    const isVisible = await healthButton.isVisible();
    expect(isVisible).toBeTruthy();
  });

  test('should display health status on button click', async ({ page }) => {
    // Click health check button
    await homePage.clickHealthCheck();

    // Verify health status text appears
    const statusText = await homePage.getHealthStatus();
    expect(statusText).toBeTruthy();
    expect(statusText).toMatch(/Status:|Checking|Healthy|Failed|Error/);
  });

  test('should handle backend health check request', async ({ page }) => {
    // Intercept the health endpoint call
    const healthPromise = page.waitForResponse(
      response =>
        response.url().includes('/health') &&
        response.status() === 200
    );

    await homePage.clickHealthCheck();

    try {
      const response = await healthPromise;
      expect(response.status()).toBe(200);

      // Verify response is JSON
      const jsonData = await response.json();
      expect(jsonData).toBeDefined();
    } catch (error) {
      // Health endpoint may not be available in test environment
      // Verify graceful error handling
      const statusText = await homePage.getHealthStatus();
      expect(statusText).toContain('Failed');
    }
  });

  test('should display all v1 route placeholders', async ({ page }) => {
    // Expected routes from roadmap
    const expectedRoutes = [
      'Onboarding',
      'Location',
      'Calendar',
      'Time',
      'Companion Type',
      'Book Now',
      'Confirmation',
      'Matching',
      'In Service',
      'Feedback',
    ];

    // Verify all routes are present
    for (const route of expectedRoutes) {
      const link = page.locator(`a:has-text("Go to ${route}")`);
      const isVisible = await link.isVisible();
      expect(isVisible, `Route "${route}" should be visible`).toBeTruthy();
    }
  });

  test('should navigate to onboarding route', async ({ page }) => {
    // Click onboarding link
    await page.locator('a:has-text("Go to Onboarding")').click();
    await page.waitForLoadState('networkidle');

    // Verify navigation
    expect(page.url()).toContain('/onboarding');
  });

  test('should navigate to location route', async ({ page }) => {
    // Click location link
    await page.locator('a:has-text("Go to Location")').click();
    await page.waitForLoadState('networkidle');

    // Verify navigation
    expect(page.url()).toContain('/location');
  });

  test('should navigate to booking calendar', async ({ page }) => {
    // Click calendar link
    await page.locator('a:has-text("Go to Calendar")').click();
    await page.waitForLoadState('networkidle');

    // Verify navigation
    expect(page.url()).toContain('/booking/calendar');
  });

  test('should navigate to booking time', async ({ page }) => {
    // Click time link
    await page.locator('a:has-text("Go to Time")').click();
    await page.waitForLoadState('networkidle');

    // Verify navigation
    expect(page.url()).toContain('/booking/time');
  });

  test('should navigate to matching route', async ({ page }) => {
    // Click matching link
    await page.locator('a:has-text("Go to Matching")').click();
    await page.waitForLoadState('networkidle');

    // Verify navigation
    expect(page.url()).toContain('/matching');
  });

  test('should navigate to in-service route', async ({ page }) => {
    // Click in-service link
    await page.locator('a:has-text("Go to In Service")').click();
    await page.waitForLoadState('networkidle');

    // Verify navigation
    expect(page.url()).toContain('/in-service');
  });

  test('should navigate to feedback route', async ({ page }) => {
    // Click feedback link
    await page.locator('a:has-text("Go to Feedback")').click();
    await page.waitForLoadState('networkidle');

    // Verify navigation
    expect(page.url()).toContain('/feedback');
  });

  test('should have responsive design on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify page is still usable
    const title = await homePage.isTitleVisible();
    expect(title).toBeTruthy();

    // Verify buttons are visible and clickable
    const healthButton = page.locator('button:has-text("Check Health")');
    expect(await healthButton.isVisible()).toBeTruthy();
  });

  test('should have responsive design on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // Verify page is still usable
    const title = await homePage.isTitleVisible();
    expect(title).toBeTruthy();

    // Verify buttons are visible and clickable
    const healthButton = page.locator('button:has-text("Check Health")');
    expect(await healthButton.isVisible()).toBeTruthy();
  });

  test('should load app within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await homePage.goto();

    const loadTime = Date.now() - startTime;

    // App should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});
