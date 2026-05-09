# E2E Testing Framework - Quick Reference

## 🚀 Quick Start

### 1. Install
```bash
npm install --save-dev @playwright/test
npx playwright install
```

### 2. Validate
```bash
npm run validate:e2e
```

### 3. Run Tests
```bash
npm run test:e2e
```

### 4. View Report
```bash
npx playwright show-report
```

---

## 📋 Available Commands

```bash
npm run test:e2e              # Run all tests (headless)
npm run test:e2e:headed       # Run with visible browser
npm run test:e2e:ui           # Interactive debugging UI
npm run test:e2e:debug        # Debug mode with inspector
npm run validate:e2e          # Validate framework setup
npm run demo:e2e              # Show framework overview
```

---

## 📊 Test Suite

**Milestone 0 Tests**: 16 tests validating:
- ✅ Home screen display & environment
- ✅ Health check backend integration
- ✅ Navigation to all V1 routes
- ✅ Responsive design (mobile/tablet)
- ✅ Performance (< 5 second load)

**Run specific test**:
```bash
npx playwright test e2e/tests/milestone-0.spec.ts -g "health check"
```

---

## 🛠 Framework Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Configuration | `playwright.config.ts` | Playwright settings |
| Tests | `e2e/tests/` | Test files |
| Page Objects | `e2e/fixtures/page-objects.ts` | UI models |
| Test Data | `e2e/fixtures/test-data.ts` | Shared constants |
| AI Utilities | `e2e/helpers/stagehand-utils.ts` | AI integration |

---

## 📚 Documentation

- **SETUP_SUMMARY.md** - Complete setup overview
- **E2E_TEST_FLOW.md** - Comprehensive testing guide
- **PLAYWRIGHT_SETUP.md** - Installation & troubleshooting
- **AI_AGENT_TEST_EXECUTION.md** - AI agent integration

---

## 🎯 Test Coverage

**16 Tests**:
1. Home screen display ✓
2. Environment display ✓
3. Health button presence ✓
4. Health status on click ✓
5. Backend health API ✓
6. Route placeholders ✓
7. Onboarding route ✓
8. Location route ✓
9. Calendar route ✓
10. Time route ✓
11. Matching route ✓
12. In-service route ✓
13. Feedback route ✓
14. Mobile responsive ✓
15. Tablet responsive ✓
16. Performance (<5s) ✓

---

## 🔍 Browsers Tested

- Chromium
- Firefox
- WebKit
- iPhone 12 (mobile)
- Pixel 5 (mobile)

---

## 📈 Reporting

After tests run:
```bash
# HTML report
npx playwright show-report

# JSON results
cat test-results/results.json

# JUnit XML (for CI)
cat test-results/junit.xml
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 8081 in use | `lsof -ti:8081 \| xargs kill -9` |
| Playwright not found | `npm install --save-dev @playwright/test` |
| Browser not found | `npx playwright install --with-deps` |
| Tests timeout | `TIMEOUT=60000 npm run test:e2e` |

---

## 🤖 For AI Agents

**Test Triggering**:
```bash
# Validate setup
npm run validate:e2e

# Run all tests
npm run test:e2e

# Parse results
cat test-results/results.json | jq '.stats'
```

**More Info**: See `AI_AGENT_TEST_EXECUTION.md`

---

## ✨ Status

✅ **Framework**: Fully configured and ready for testing  
✅ **Tests**: 16 sample tests for Milestone 0  
✅ **Documentation**: Complete with guides and references  
✅ **AI Integration**: Ready for agent automation  
✅ **Validation**: All components verified  

**Next**: Run `npm run validate:e2e` to confirm setup

---

**Last Updated**: May 9, 2026  
**Framework**: Playwright ^1.48.0  
**Status**: Production Ready 🚀
