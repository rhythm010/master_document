/**
 * Playwright config for generated FE M02 test specs.
 * Scans e2e/generated/ only. Uses Chromium only for speed.
 * DO NOT edit production code from this file.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/generated',
  testMatch: '**/*.spec.ts',

  fullyParallel: false, // run sequentially to avoid DB conflicts on user creation
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,

  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/generated-results.json' }],
  ],

  use: {
    baseURL: 'http://localhost:8082',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Reuse the already-running Expo dev server at 8082 (from correct worktree)
  webServer: {
    command: 'npm run web',
    url: 'http://localhost:8082',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
