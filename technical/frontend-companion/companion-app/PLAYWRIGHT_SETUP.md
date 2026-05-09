# Playwright & Stagehand Setup Guide - Installation & Troubleshooting

## Current Status

The Playwright and Stagehand E2E testing framework has been configured for the Companion mobile app. All necessary configuration files and test templates have been created. Due to npm registry access restrictions in the current environment, manual installation steps are provided below.

## Installation Methods

### Method 1: Direct npm Installation (Recommended)

If you have direct npm registry access on your machine:

```bash
cd /Users/rhythmkhanna/Docs/COMPANION/master_document/technical/frontend-companion/companion-app

# Install Playwright test framework
npm install --save-dev @playwright/test

# Install Playwright browsers (required)
npx playwright install

# Optional: Install Stagehand for AI-powered tests (when available)
npm install --save-dev @stagehand/core @stagehand/browser
```

### Method 2: Using Node Package Manager Cache

If you have npm cache or offline packages:

```bash
# Clear npm cache and retry
npm cache clean --force
npm install --save-dev @playwright/test

# Install browsers
npx playwright install
```

### Method 3: Yarn Package Manager

If npm registry is unavailable, try Yarn:

```bash
cd companion-app
yarn add --dev @playwright/test
yarn playwright install
```

### Method 4: From Tarball/Pre-built

If your organization has pre-built packages:

```bash
npm install --save-dev ./playwright-test-latest.tgz
```

## Verifying Installation

After installation, verify Playwright is working:

```bash
# Check Playwright version
npx playwright --version

# List installed browsers
npx playwright install --with-deps

# Run test discovery
npx playwright test --list
```

## Project Setup Overview

All files are already created in the companion-app directory:

```
├── playwright.config.ts                          # Playwright configuration
├── E2E_TEST_FLOW.md                             # Comprehensive testing guide
├── e2e/
│   ├── tests/
│   │   └── milestone-0.spec.ts                  # Sample Milestone 0 tests
│   ├── fixtures/
│   │   ├── page-objects.ts                      # Page Object Model classes
│   │   └── test-data.ts                         # Test data and fixtures
│   └── helpers/
│       └── stagehand-utils.ts                   # Stagehand utilities (ready for integration)
├── package.json                                  # Updated with E2E test scripts
└── .gitignore                                   # Should exclude node_modules, test-results
```

## Available Test Commands

Once Playwright is installed, use these commands:

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run tests with interactive UI
npm run test:e2e:ui

# Run tests in debug mode
npm run test:e2e:debug

# Run tests in headed mode (visible browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test e2e/tests/milestone-0.spec.ts

# Run tests matching pattern
npx playwright test --grep "health check"

# Generate and view HTML report
npx playwright show-report
```

## Environment Variables

Configure via `.env` or command line:

```bash
# Web server URL
BASE_URL=http://localhost:8081

# Headless browser mode
HEADED=false

# Parallel workers
WORKERS=4

# Retry failed tests
RETRIES=2

# Timeout per test (milliseconds)
TIMEOUT=30000
```

## Configuration Details

### Playwright Configuration (`playwright.config.ts`)

The configuration includes:

- **Base URL**: `http://localhost:8081` (web version of app)
- **Test Directory**: `e2e/tests/`
- **Test Pattern**: `**/*.spec.ts`
- **Reporters**: HTML, JSON, JUnit
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile Views**: iPhone 12, Pixel 5
- **Web Server**: Starts `npm run web` automatically
- **Screenshots**: On failure
- **Videos**: On failure
- **Traces**: On first retry

### Test Scripts (`package.json`)

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:headed": "playwright test --headed"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0"
  }
}
```

## First Test Run

Once Playwright is installed, run the sample test:

```bash
# Start from companion-app directory
cd technical/frontend-companion/companion-app

# Run Milestone 0 tests
npm run test:e2e -- e2e/tests/milestone-0.spec.ts

# View results
npx playwright show-report
```

## Test Structure

### Milestone 0 Test Suite (`milestone-0.spec.ts`)

16 tests validating:

1. **Home Screen Display**
   - Milestone 0 title visible
   - Environment information displayed
   - Health check button present

2. **Backend Integration**
   - Health check API call
   - Response handling (success and failure)
   - Graceful error handling

3. **Navigation & Routing**
   - All 11 V1 route placeholders accessible
   - URL navigation working
   - Route links clickable

4. **Responsive Design**
   - Mobile viewport (375×667)
   - Tablet viewport (768×1024)
   - Desktop viewport

5. **Performance**
   - App load time < 5 seconds

### Page Objects (`page-objects.ts`)

Reusable page models for:
- `HomePage`
- `OnboardingPage`
- `LocationPage`
- `BookingPage`
- `MatchingPage`
- `InServicePage`
- `FeedbackPage`

### Test Fixtures (`test-data.ts`)

Shared data:
- Health endpoint responses
- App routes
- Page titles
- UI elements
- Test users
- Booking data
- Network patterns

### Stagehand Utilities (`stagehand-utils.ts`)

AI-powered helpers (ready for future integration):
- `initStagehand()` - Initialize AI context
- `clickByDescription()` - AI-powered click
- `observe()` - AI observation
- `extractData()` - AI data extraction
- `validateState()` - AI state validation
- `StagehandContext` - Context manager class

## Troubleshooting

### npm Registry 403 Forbidden Error

**Cause**: Network/firewall restriction or corporate proxy

**Solutions**:
1. Try from a different network
2. Configure npm proxy:
   ```bash
   npm config set registry https://registry.npmjs.org/
   npm config set proxy http://proxy:port
   npm config set https-proxy http://proxy:port
   ```
3. Use Yarn instead of npm
4. Contact network administrator

### Port Already in Use (8081)

**Cause**: Web server already running on port 8081

**Solution**:
```bash
# Kill existing process
lsof -ti:8081 | xargs kill -9

# Or configure different port in playwright.config.ts
```

### Tests Timeout

**Cause**: Web server not starting or network issues

**Solution**:
```bash
# Start web server manually
npm run web

# In another terminal, run tests with longer timeout
TIMEOUT=60000 npm run test:e2e

# Or increase timeout in playwright.config.ts
```

### Browser Not Found

**Cause**: Playwright browsers not installed

**Solution**:
```bash
npx playwright install --with-deps
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd technical/frontend-companion/companion-app
          npm install
          npx playwright install --with-deps
      
      - name: Run E2E tests
        run: |
          cd technical/frontend-companion/companion-app
          npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: technical/frontend-companion/companion-app/playwright-report/
```

## Next Steps

1. **Install Playwright**: Follow one of the installation methods above
2. **Run Sample Test**: `npm run test:e2e -- e2e/tests/milestone-0.spec.ts`
3. **Review Results**: `npx playwright show-report`
4. **Write More Tests**: Copy patterns from `milestone-0.spec.ts`
5. **Integrate Stagehand**: When package becomes available
6. **Setup CI/CD**: Add to GitHub Actions or your CI provider

## Resources

- [Playwright Official Docs](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Stagehand Documentation](https://github.com/browserbase/stagehand)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)

## Support

For issues:
1. Check E2E_TEST_FLOW.md for detailed testing guide
2. Review playwright.config.ts for configuration details
3. Examine sample test in e2e/tests/milestone-0.spec.ts
4. Enable debug mode: `npm run test:e2e:debug`

---

**Last Updated**: May 9, 2026
**Playwright Version**: ^1.48.0
**Status**: Ready for manual installation and testing
