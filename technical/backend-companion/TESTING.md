# Testing Guide

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

# Run identity module tests
npm run test:identity
```

### Direct Python Usage

If you prefer to use the Python script directly:

```bash
# Run specific test
python3 test_runner.py qa/JRN-002-happy-signup-login-client-companion.json

# Run multiple tests
python3 test_runner.py src/modules/identity/__tests__/*.json
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

---

## Best Practices

1. **Keep services running** - Don't stop/start containers between tests
2. **Run tests one at a time** - Avoid parallel test execution (for now)
3. **Check results** - Review JSON reports in `results/` folders
4. **Manual cleanup when needed** - Test data persists by default for inspection
   ```bash
   # Quick cleanup of test users
   docker compose exec db psql -U companion -d companion -c \
     "DELETE FROM users WHERE email LIKE '%@test.com' OR email LIKE '%+RUN%';"
   ```
5. **Use unique emails** - Tests generate unique emails to avoid conflicts
6. **Inspect test data** - Created entities are listed in report's `testDataCreated` field

---

## CI/CD Integration

For CI environments, you'll need to:

1. Start services before tests:
   ```bash
   docker compose up -d
   npm run dev &
   sleep 5  # Wait for services to be ready
   ```

2. Run tests:
   ```bash
   python3 test_runner.py qa/*.json
   ```

3. Cleanup:
   ```bash
   docker compose down
   ```
