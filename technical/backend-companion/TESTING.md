# Testing Guide

## Test Environment Setup

### Prerequisites

Before running tests, you need to set up your test environment configuration.

### Quick Setup

1. **Copy the example environment file:**
   ```bash
   cp .env.test.example .env.test
   ```

2. **Generate strong tokens:**
   ```bash
   node -e "const c=require('crypto');console.log('JWT_SECRET='+c.randomBytes(32).toString('hex'));console.log('INTERNAL_API_TOKEN='+c.randomBytes(32).toString('hex'))"
   ```

3. **Update `.env.test` with generated tokens:**
   - Replace `REPLACE_WITH_GENERATED_64_CHAR_HEX_TOKEN` for `JWT_SECRET`
   - Replace `REPLACE_WITH_GENERATED_64_CHAR_HEX_TOKEN` for `INTERNAL_API_TOKEN`

4. **Verify your test database is running:**
   ```bash
   docker ps | grep postgres
   ```

### Why .env.test?

- `.env` is for development environment
- `.env.test` is for test environment (gitignored, contains test-specific tokens)
- Test runner automatically loads `.env.test` if it exists
- This separates test tokens from development tokens for security

### Required Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `INTERNAL_API_TOKEN` | Authentication for internal API endpoints (roster populate, etc.) | 64-char hex string |
| `JWT_SECRET` | JWT token signing | 64-char hex string |
| `DATABASE_URL` | Test database connection | `postgresql://companion:companion@localhost:5433/companion_test` |

### Troubleshooting

**Getting 401 Unauthorized on internal endpoints?**
- Check that `.env.test` exists
- Verify `INTERNAL_API_TOKEN` is set and matches between test file and server
- Restart the API server after changing `.env.test`

**Tests can't find environment variables?**
- Ensure you're running tests via `npm run test:validator` or `./run_tests.sh`
- Both scripts automatically load `.env.test`

---

## Prerequisites

Before running tests, ensure your **local development environment is running**:

```bash
# 1. Start Docker containers (database + Mailpit)
docker compose up -d

# 2. Start API server (in a separate terminal)
npm run dev
```

The test runner uses your existing local environment and does **NOT** start new services.

---

## Running Tests

### Quick Start

```bash
# Run all journey tests (with environment checks)
npm run test:validator

# Run specific test file
./run_tests.sh qa/JRN-002-happy-signup-login-client-companion.json

# Run with TypeScript runner directly
npx tsx src/test-runner/index.ts qa/JRN-*.json
```

### Direct TypeScript Usage

```bash
# Run specific test
npx tsx src/test-runner/index.ts qa/JRN-002-happy-signup-login-client-companion.json

# Run multiple tests with glob pattern
npx tsx src/test-runner/index.ts src/modules/identity/__tests__/*.json

# Run with custom concurrency
npx tsx src/test-runner/index.ts --concurrency=4 qa/*.json
```

---

## How It Works

### Environment Setup (Before Tests)

1. **Docker Containers** - Database and Mailpit must be running
2. **API Server** - Node.js API must be running on `http://localhost:3000`
3. **Database Schema** - Prisma migrations must be applied

### Test Execution Flow

1. **Environment Check** - Verifies API, database, and Mailpit are accessible
2. **Seed Data** - Creates test users/data in your **existing database**
3. **Execute Steps** - Runs API requests, DB queries, external checks
4. **Validate Assertions** - Checks API responses, DB state, emails
5. **Track Created Data** - Records all created entities (users, bookings, etc.) in the report
6. **Generate Report** - Saves JSON results to `results/` folder

**Note:** Test data is **NOT cleaned up by default**. This allows you to:
- Inspect test data after execution for debugging
- Verify database state manually
- Rerun tests without re-seeding

All created test data is tracked in the JSON report under `testDataCreated` with entity type, ID, and run marker.

### What Gets Created

Test users and data are created in your **local database** and **remain after tests complete** (default behavior):
- Test users (with unique email addresses)
- Companion profiles (if needed)
- Roster slots (if needed)
- Venue assignments (if needed)

All created entities are tracked in the test report under `testDataCreated` with:
- Entity type (user, booking, venue, etc.)
- Entity ID
- Run marker (e.g., `RUN-20260426-001`)

**Manual Cleanup:** If you want to clean up test data:
```bash
# Delete test users created by a specific run
docker compose exec db psql -U companion -d companion -c "DELETE FROM users WHERE email LIKE '%+RUN%';"

# Or reset the entire database (WARNING: deletes all data)
npm run db:reset
```

---

## Test Runner Configuration

The test runner is optimized for performance with configurable options in `src/test-runner/config.ts`:

### Configuration Options

```typescript
// Environment variables (can be set in .env)
API_BASE_URL           // Default: http://localhost:3000
MAILPIT_BASE_URL       // Default: http://localhost:8025
DB_POOL_SIZE           // Default: 10
TEST_RUNNER_CONCURRENCY // Default: CPU cores - 1

// Configuration parameters
config.execution.concurrency    // Parallel test execution limit (default: CPU cores - 1)
config.execution.maxConcurrency // Maximum allowed concurrency (16)
config.database.poolSize        // Shared DB connection pool size (10)
config.mailpit.pollIntervalMs   // Initial email polling interval (200ms)
config.mailpit.maxPollIntervalMs // Max email polling interval (1000ms)
config.mailpit.backoffMultiplier // Exponential backoff multiplier (2.5)
```

### Performance Features

**Parallel Test Execution:**
- Journey tests (`qa/*.json`) run **sequentially** to preserve order
- Module tests (`src/modules/*/__tests__/*.json`) run **in parallel** with configurable concurrency
- Default concurrency: Number of CPU cores - 1
- Override with `--concurrency=N` flag

**Shared Database Pool:**
- Single connection pool shared across all tests
- Reduces connection overhead
- Configurable pool size (default: 10 connections)

**Optimized Email Polling:**
- Starts at 200ms, increases to 1000ms with exponential backoff
- Early exit on first match
- Graceful skip if Mailpit unavailable

**Parallel Seed Operations:**
- Venues and users seed in parallel within same entity type
- Password hashing happens concurrently
- Safe dependency handling for related entities

**Cached Environment Checks:**
- Environment (API, DB, Mailpit) checked once at startup
- Results reused across all test files
- Faster execution for multiple tests

### Customizing Concurrency

```bash
# Use 4 parallel workers
npx tsx src/test-runner/index.ts --concurrency=4 src/modules/**/__tests__/*.json

# Use maximum concurrency (16)
npx tsx src/test-runner/index.ts --concurrency=16 src/modules/**/__tests__/*.json

# Use environment variable
TEST_RUNNER_CONCURRENCY=8 npx tsx src/test-runner/index.ts src/modules/**/__tests__/*.json
```

### Expected Performance Gain

With these optimizations, the test runner achieves:
- **>50% execution time reduction** for module test suites
- **Faster seed data operations** with parallel inserts
- **Reduced email polling time** with exponential backoff
- **Lower connection overhead** with shared DB pool

---

## Test Result Locations

- **Journey Tests**: `qa/results/*.json`
- **Module Tests**: `src/modules/{module}/results/*.json`

---

## Troubleshooting

### "Environment not ready" Error

**Cause**: One or more services aren't running.

**Fix**:
```bash
# Check what's running
docker compose ps
curl http://localhost:3000/health
curl http://localhost:8025/api/v1/messages

# Start missing services
docker compose up -d
npm run dev
```

### "Permission denied" on run_tests.sh

**Fix**:
```bash
chmod +x run_tests.sh
```

### Docker Asking for Permission (macOS)

**Cause**: macOS security prompt for Docker Desktop.

**Fix**: 
1. Allow Docker in System Settings → Privacy & Security
2. Grant Docker full disk access if needed
3. Run `docker compose ps` once manually to clear prompts

### Database Connection Failed

**Cause**: Database container not running or wrong credentials.

**Fix**:
```bash
# Check containers
docker compose ps

# Restart if needed
docker compose restart db

# Verify connection
docker compose exec db psql -U companion -d companion -c "SELECT 1;"
```

### Parallel Execution Issues

**Symptom**: Tests fail when run in parallel but pass individually.

**Possible Causes**:
1. **Data conflicts** - Tests using same test data (rare, each test has unique RUN_ID)
2. **Resource contention** - Too many concurrent connections

**Fix**:
```bash
# Reduce concurrency
npx tsx src/test-runner/index.ts --concurrency=2 src/modules/**/__tests__/*.json

# Increase DB pool size
DB_POOL_SIZE=20 npx tsx src/test-runner/index.ts src/modules/**/__tests__/*.json

# Run sequentially (slowest, but most reliable)
for file in src/modules/**/__tests__/*.json; do
  npx tsx src/test-runner/index.ts "$file"
done
```

### Production Environment Error

**Symptom**: "Test runner cannot execute in production environment"

**Fix**: 
```bash
# Set NODE_ENV to development or test
NODE_ENV=development npx tsx src/test-runner/index.ts qa/*.json

# Or in .env file
echo "NODE_ENV=development" >> .env
```

---

## Best Practices

1. **Keep services running** - Don't stop/start containers between tests
2. **Use parallel execution for module tests** - Let the runner optimize execution
3. **Check results** - Review JSON reports in `results/` folders
4. **Manual cleanup when needed** - Test data persists by default for inspection
   ```bash
   # Quick cleanup of test users
   docker compose exec db psql -U companion -d companion -c \
     "DELETE FROM users WHERE email LIKE '%@test.local';"
   ```
5. **Use unique emails** - Tests generate unique emails to avoid conflicts
6. **Inspect test data** - Created entities are listed in report's `testDataCreated` field
7. **Monitor resource usage** - Adjust concurrency based on system capacity
8. **Run journey tests first** - They validate end-to-end flows before unit tests

---

## CI/CD Integration

For CI environments, you'll need to:

1. Set environment to test mode:
   ```bash
   export NODE_ENV=test
   ```

2. Start services before tests:
   ```bash
   docker compose up -d
   npm run dev &
   sleep 5  # Wait for services to be ready
   ```

3. Run tests with appropriate concurrency:
   ```bash
   # Use CI-optimized concurrency
   npx tsx src/test-runner/index.ts --concurrency=4 qa/*.json src/modules/**/__tests__/*.json
   ```

4. Cleanup:
   ```bash
   docker compose down
   ```
