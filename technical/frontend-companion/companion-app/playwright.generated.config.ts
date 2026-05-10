/**
 * Playwright config for generated FE UI test specs.
 * Extends the main playwright.config.ts settings but targets e2e/generated/.
 * Do NOT modify production code from generated specs.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/generated',
  testMatch: '**/*.spec.ts',

  fullyParallel: false,
  retries: 0,
  workers: 1,

  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/generated-results.json' }],
  ],

  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run web',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
