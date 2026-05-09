# Companion App E2E Testing Guide

## Overview

This document describes the automated E2E testing setup using Playwright and Stagehand for the Companion mobile app web version.

## Architecture

### Technology Stack

- **Playwright**: Browser automation framework for cross-browser testing
- **Stagehand**: AI-powered test automation for intelligent element interaction
- **TypeScript**: Type-safe test code
- **Reporters**: HTML, JSON, and JUnit formats

### Test Structure

```
e2e/
├── tests/                      # Test files (.spec.ts)
│   ├── milestone-0.spec.ts     # Milestone 0 functionality tests
│   ├── home.spec.ts            # Home page tests
│   ├── onboarding.spec.ts      # Onboarding flow tests
│   ├── booking.spec.ts         # Booking flow tests
│   └── ...other feature tests
├── fixtures/                   # Shared test fixtures and utilities
│   └── test-data.ts           # Mock data, test users, API responses
├── helpers/                    # Helper functions
│   ├── page-objects.ts        # Page Object Model helpers
│   └── stagehand-utils.ts     # Stagehand integration utilities
└── README.md                  # This file
```

## Running Tests

### Installation

Install dependencies (if not already done):

```bash
npm install
```

### Available Commands

| Command | Purpose |
|---------|---------|
| `npm run test:e2e` | Run all E2E tests in headless mode |
| `npm run test:e2e:ui` | Run tests with Playwright UI (interactive) |
| `npm run test:e2e:debug` | Run tests in debug mode with step-by-step execution |
| `npm run test:e2e:headed` | Run tests in headed mode (visible browser) |

### Running Specific Tests

```bash
# Run a specific test file
npx playwright test e2e/tests/milestone-0.spec.ts

# Run tests matching a pattern
npx playwright test --grep "health check"

# Run a specific test
npx playwright test e2e/tests/milestone-0.spec.ts -g "should display milestone 0 home screen"
```

### Environment Variables

```bash
# Base URL (default: http://localhost:8081)
BASE_URL=http://localhost:8081 npm run test:e2e

# Headless mode (default: true)
HEADED=true npm run test:e2e
```

## Test Flow Specification

### General Test Flow Pattern

```
1. Setup
   ├─ Start web server (automatically via webServer config)
   ├─ Navigate to baseURL
   └─ Initialize Stagehand context

2. Page Object Interaction
   ├─ Identify elements using Stagehand AI or Playwright selectors
   ├─ Interact with UI (click, type, submit)
   └─ Wait for expected state changes

3. Assertions & Validation
   ├─ Assert page content
   ├─ Verify API calls (via network interception if needed)
   ├─ Check database state (if applicable)
   └─ Validate visual elements

4. Cleanup
   ├─ Close browser
   └─ Generate reports
```

### Example: Milestone 0 Test Flow

```
Test: "Home Screen Displays Milestone 0 Title"

1. Setup:
   - Start web server on localhost:8081
   - Launch browser
   - Navigate to /

2. Interaction:
   - Wait for page to load
   - Locate "Companion App - Milestone 0" heading via Stagehand

3. Assertion:
   - Assert heading is visible
   - Assert environment is displayed
   - Assert "Check Health" button is present

4. Cleanup:
   - Close browser
   - Generate HTML report
```

## Stagehand Integration

Stagehand provides AI-powered element interaction. Use it for:

- **Complex UI interactions**: "Click the button that says 'Continue'"
- **AI-powered waits**: Automatically wait for expected UI changes
- **Visual validation**: Check visual states without brittle selectors
- **Natural language**: Write tests in descriptive English

### Stagehand Example

```typescript
import { Page } from '@playwright/test';
import Stagehand from '@stagehand/browser';

async function useStagehand(page: Page) {
  const stagehand = new Stagehand({ page });
  await stagehand.init();

  // AI-powered interaction
  await stagehand.act({
    action: 'click the "Check Health" button',
  });

  // Validate result
  const result = await stagehand.observe({
    instruction: 'Tell me if the health status changed',
  });

  await stagehand.close();
}
```

## Test Categories

### 1. Milestone Tests
- **Location**: `e2e/tests/milestone-0.spec.ts`
- **Purpose**: Validate each milestone's core requirements
- **Coverage**: App shell, routing, basic functionality

### 2. Feature Flow Tests
- **Location**: `e2e/tests/<feature>.spec.ts`
- **Purpose**: Test complete user journeys
- **Coverage**: Onboarding → Booking → Matching → In Service → Feedback

### 3. Component Tests
- **Location**: `e2e/tests/components/*.spec.ts`
- **Purpose**: Test individual components in isolation
- **Coverage**: Buttons, forms, navigation, display logic

### 4. API Integration Tests
- **Location**: `e2e/tests/api/*.spec.ts`
- **Purpose**: Test backend API interactions
- **Coverage**: Health check, endpoints, error handling

## Page Object Model

Define reusable page objects for maintainability:

```typescript
// e2e/fixtures/page-objects.ts

export class HomePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async getTitle() {
    return this.page.locator('text=Companion App - Milestone 0');
  }

  async clickHealthCheckButton() {
    return this.page.locator('button:has-text("Check Health")').click();
  }

  async getHealthStatus() {
    return this.page.locator('text=/Status:.*/).textContent();
  }
}
```

## Test Data & Fixtures

Use shared fixtures for test data:

```typescript
// e2e/fixtures/test-data.ts

export const testData = {
  health: {
    healthy: { status: 'ok', version: '1.0.0' },
    unhealthy: { status: 'error', message: 'Service unavailable' },
  },
  users: {
    client: { email: 'client@test.com', role: 'CLIENT' },
    companion: { email: 'companion@test.com', role: 'COMPANION' },
  },
};
```

## Debugging Tests

### Using Playwright Inspector

```bash
# Launch tests with inspector
npm run test:e2e:debug

# Step through tests interactively
# Inspector opens with browser controls
```

### Using Playwright UI Mode

```bash
# Launch UI mode (recommended)
npm run test:e2e:ui

# Features:
# - Watch live browser
# - Step through tests
# - Time-travel debugging
# - Inspect network requests
```

### Viewing Test Reports

After test run, open the HTML report:

```bash
npx playwright show-report
```

## Best Practices

1. **Use Page Objects**: Keep test code clean and maintainable
2. **Avoid Hard Waits**: Use Playwright's built-in waits instead of `sleep()`
3. **Make Tests Independent**: Each test should be runnable in any order
4. **Use Meaningful Assertions**: Assert on business logic, not implementation details
5. **Keep Tests Focused**: One feature per test file
6. **Mock External APIs**: Use network interception for reliability
7. **Leverage Stagehand**: Use AI interaction for complex, non-brittle automation

## CI/CD Integration

Tests run in CI with the following settings:

- **Headless**: true
- **Workers**: 1 (serial)
- **Retries**: 2
- **Timeout**: 30 seconds per test

Configure in GitHub Actions / your CI provider:

```yaml
- name: Run E2E Tests
  run: npm run test:e2e

- name: Upload Test Results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tests timeout | Check if web server started successfully, increase timeout in config |
| Element not found | Use Playwright Inspector to inspect element, verify selectors |
| Flaky tests | Add explicit waits, use Stagehand for intelligent waits |
| Port in use | Kill existing process on 8081, or configure different port |
| Browser crash | Update Playwright: `npx playwright install` |

## Writing Your First Test

Create `e2e/tests/your-test.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('/');
  
  // Use Playwright selectors
  const title = await page.locator('text=Companion App').isVisible();
  expect(title).toBeTruthy();
  
  // Or use Stagehand for AI interaction
  // await stagehand.act({ action: 'click the health check button' });
});
```

Run:

```bash
npx playwright test e2e/tests/your-test.spec.ts --headed
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Inspector](https://playwright.dev/docs/inspector)
- [Stagehand Documentation](https://github.com/browserbase/stagehand)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)
- [Network Interception](https://playwright.dev/docs/network#handle-requests)

## Support & Updates

For issues or updates to this guide:
1. Check existing test examples in `e2e/tests/`
2. Review Playwright/Stagehand documentation
3. Ask in code review or team discussions
