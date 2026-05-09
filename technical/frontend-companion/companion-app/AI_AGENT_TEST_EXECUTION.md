# AI Agent Test Execution Instructions

## Overview

This document provides instructions for AI agents to initiate and manage E2E test execution for the Companion app frontend.

## Test Invocation Commands

### For Agents to Use

```bash
# Validate framework setup
npm run validate:e2e

# Show framework demonstration
npm run demo:e2e

# Run all tests (headless)
npm run test:e2e

# Run tests with interactive UI (for debugging)
npm run test:e2e:ui

# Run tests in debug mode
npm run test:e2e:debug

# Run tests with visible browser
npm run test:e2e:headed
```

### Running Specific Tests

```bash
# Run specific test file
npx playwright test e2e/tests/milestone-0.spec.ts

# Run tests matching a pattern
npx playwright test --grep "health check"

# Run specific test by name
npx playwright test -g "should display milestone 0 home screen"

# Run with specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Viewing Results

```bash
# Generate and display HTML report
npx playwright show-report

# Show last test results JSON
cat test-results/results.json

# View JUnit XML for CI systems
cat test-results/junit.xml
```

## Test Execution Workflow

### User Command Flow

1. **User Request**: "Run E2E tests for Milestone 0"

2. **Agent Initialization**:
   ```bash
   cd /Users/rhythmkhanna/Docs/COMPANION/master_document/technical/frontend-companion/companion-app
   npm run validate:e2e
   ```

3. **Agent Execution**:
   ```bash
   npm run test:e2e -- e2e/tests/milestone-0.spec.ts
   ```

4. **Agent Report Generation**:
   ```bash
   npx playwright show-report
   ```

5. **Agent Response** to user with:
   - Test results (passed/failed count)
   - Failed test details
   - Screenshots/videos of failures
   - Performance metrics

## Framework Structure for Agents

### File Locations

- **Configuration**: `playwright.config.ts`
- **Tests**: `e2e/tests/*.spec.ts`
- **Page Objects**: `e2e/fixtures/page-objects.ts`
- **Test Data**: `e2e/fixtures/test-data.ts`
- **Reports**: `playwright-report/`, `test-results/`

### Available Test Data

Agents can access test data via imports:

```typescript
import { testData } from '../fixtures/test-data';

// Usage
const apiUrl = testData.env.apiUrl;
const routes = testData.routes;
const pages = testData.pages;
```

### Available Page Objects

```typescript
import {
  HomePage,
  OnboardingPage,
  LocationPage,
  BookingPage,
  MatchingPage,
  InServicePage,
  FeedbackPage,
} from '../fixtures/page-objects';

// Usage
const homePage = new HomePage(page);
await homePage.goto();
```

## AI Agent Capabilities

### Pre-Test Validation

Agents should verify before running tests:

```bash
# 1. Check if framework is configured
npm run validate:e2e

# 2. Check if web server can start
npm run web &

# 3. Verify backend API is available
curl http://localhost:3000/health
```

### During Test Execution

Agents can:

1. **Monitor Progress**: Watch test output in real-time
2. **Capture Failures**: Get screenshots and videos
3. **Parse Results**: Read JSON test results
4. **Extract Metrics**: Get performance data
5. **Identify Issues**: Analyze failure reasons

### Post-Test Analysis

After tests complete, agents can:

```bash
# Parse results
node -e "
const results = require('./test-results/results.json');
console.log('Total:', results.stats.expected);
console.log('Passed:', results.stats.expected - results.stats.failed);
console.log('Failed:', results.stats.failed);
"

# List failed tests
grep -l '"ok": false' test-results/*.json

# View specific failure details
jq '.suites[0].tests[] | select(.ok==false)' test-results/results.json
```

## Test Triggering Scenarios

### Scenario 1: Basic Test Run

**User**: "Run all E2E tests"

**Agent Actions**:
1. Navigate to companion-app directory
2. Validate framework: `npm run validate:e2e`
3. Run tests: `npm run test:e2e`
4. Wait for completion
5. Parse results: `cat test-results/results.json`
6. Report to user

### Scenario 2: Debugging Failed Test

**User**: "Debug why the health check test is failing"

**Agent Actions**:
1. Run specific test with debug UI: `npm run test:e2e:debug -- -g "health check"`
2. User steps through test manually
3. Agent collects failure details
4. Report findings

### Scenario 3: Visual Validation

**User**: "Run tests and show me the visual report"

**Agent Actions**:
1. Run tests: `npm run test:e2e:headed`
2. Generate report: `npx playwright show-report`
3. Navigate to report HTML
4. Provide link/path to user

### Scenario 4: CI/CD Integration

**Agent**: "Verify tests pass before merging"

**Actions**:
1. Run in headless mode: `npm run test:e2e`
2. Check exit code: `echo $?`
3. If non-zero, collect failures
4. Report to CI system

## Environment Setup for Agents

Agents should ensure:

```bash
# 1. Node.js is available
node --version  # Should be v18+

# 2. npm is available
npm --version

# 3. Playwright is installed
npm install --save-dev @playwright/test

# 4. Browsers are installed
npx playwright install

# 5. Web server can start
npm run web  # In background, on port 8081

# 6. Test directory exists
ls -la e2e/tests/

# 7. Configuration exists
ls -la playwright.config.ts
```

## Error Handling

### Common Errors & Agent Responses

#### Error: "Port 8081 already in use"

**Agent Action**:
```bash
# Kill existing process
lsof -ti:8081 | xargs kill -9

# Retry tests
npm run test:e2e
```

#### Error: "Playwright not found"

**Agent Action**:
```bash
# Install missing dependency
npm install --save-dev @playwright/test
npx playwright install
```

#### Error: "Backend not responding"

**Agent Action**:
```bash
# Check if backend is running
curl http://localhost:3000/health

# If not running, report to user
echo "Backend API not available"
```

#### Error: "Test timeout"

**Agent Action**:
```bash
# Run with longer timeout
TIMEOUT=60000 npm run test:e2e

# If still timing out, run with debugging
npm run test:e2e:debug
```

## Test Results Parsing

### JSON Results Structure

```json
{
  "config": { "name": "Playwright Test" },
  "stats": {
    "expected": 16,
    "failed": 0,
    "flaky": 0,
    "skipped": 0,
    "timeout": 0,
    "ok": true
  },
  "suites": [
    {
      "title": "Milestone 0: Real Device Placeholder App",
      "tests": [
        {
          "title": "should display milestone 0 home screen",
          "ok": true,
          "duration": 1234
        }
      ]
    }
  ]
}
```

### Agent Result Extraction

```bash
# Total pass/fail count
jq '.stats | "Passed: \(.expected - .failed), Failed: \(.failed)"' test-results/results.json

# Failed test names
jq '.suites[].tests[] | select(.ok==false) | .title' test-results/results.json

# Test duration
jq '.suites[].tests[] | "\(.title): \(.duration)ms"' test-results/results.json
```

## Test Modification by Agents

### Adding New Tests

Agents can create new test files following the pattern:

```typescript
// e2e/tests/new-feature.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from '../fixtures/page-objects';

test.describe('New Feature', () => {
  test('should test feature', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    // Test logic here
  });
});
```

### Modifying Test Data

Agents can update shared data:

```typescript
// e2e/fixtures/test-data.ts
export const testData = {
  // ... existing data
  myNewData: {
    key: 'value',
  },
};
```

## Best Practices for Agents

1. **Always validate first**: Run `npm run validate:e2e` before tests
2. **Use appropriate mode**: Headless for CI, headed for debugging
3. **Parse results properly**: Use JSON format for machine reading
4. **Handle timeouts gracefully**: Increase timeout before failing
5. **Report detailed failures**: Include screenshots and error logs
6. **Clean up after tests**: Kill background processes
7. **Document test changes**: Comment added/modified tests

## Integration Points

### For Test Design Agent

- Creates new test files in `e2e/tests/`
- Updates `e2e/fixtures/test-data.ts` with new test data
- Adds page objects to `e2e/fixtures/page-objects.ts`

### For Test Validator Agent

- Executes: `npm run test:e2e`
- Parses: `test-results/results.json`
- Reports: Pass/fail, failures, metrics

### For Coding Agent

- Modifies components to match test requirements
- Ensures tests pass after code changes
- Validates frontend implementation against test specs

## Command Reference

| Command | Purpose | Output |
|---------|---------|--------|
| `npm run validate:e2e` | Validate setup | Text report |
| `npm run demo:e2e` | Show framework | Framework overview |
| `npm run test:e2e` | Run all tests | Test results |
| `npm run test:e2e:ui` | Interactive test | Visual UI |
| `npm run test:e2e:debug` | Debug mode | Inspector |
| `npm run test:e2e:headed` | Visible browser | Live browser |
| `npx playwright show-report` | View HTML report | Browser window |

## Support

For issues with test execution:
1. Check PLAYWRIGHT_SETUP.md for troubleshooting
2. Review E2E_TEST_FLOW.md for testing patterns
3. Check test implementation in e2e/tests/
4. Enable debug mode for detailed logs

---

**Last Updated**: May 9, 2026
**Framework Version**: Playwright ^1.48.0
**Status**: Ready for AI Agent Integration
