# Test Environment Setup - Quick Reference

## First Time Setup (5 minutes)

```bash
# 1. Copy the template
cp .env.test.example .env.test

# 2. Generate strong tokens
node -e "const c=require('crypto');console.log('JWT_SECRET='+c.randomBytes(32).toString('hex'));console.log('INTERNAL_API_TOKEN='+c.randomBytes(32).toString('hex'))"

# 3. Edit .env.test and replace BOTH placeholder tokens:
#    - JWT_SECRET=REPLACE_WITH_GENERATED_64_CHAR_HEX_TOKEN
#    - INTERNAL_API_TOKEN=REPLACE_WITH_GENERATED_64_CHAR_HEX_TOKEN
#
#    Replace with the tokens from step 2

# 4. Done! Run tests
npm run test:validator
```

## Expected Output

When running tests, you should see:
```
✓ Loaded test environment from .env.test
```

## Troubleshooting

### ⚠️ .env.test not found
**Solution:** Run step 1 above (copy template)

### ❌ 401 Unauthorized on internal endpoints
**Solution:** 
1. Check `.env.test` exists
2. Verify `INTERNAL_API_TOKEN` is set (not placeholder)
3. Restart API server: `npm run dev`

### ❌ Tests can't find environment variables
**Solution:** Always run tests via:
- `npm run test:validator` (recommended)
- `./run_tests.sh qa/test-file.json`

**Don't run:** `npx tsx src/test-runner/index.ts` directly without environment setup

## Files Overview

| File | Purpose | Committed? |
|------|---------|-----------|
| `.env` | Development environment | ✅ NO (gitignored) |
| `.env.test` | **Test environment** (YOU create this) | ✅ NO (gitignored) |
| `.env.test.example` | Template to copy | ✅ YES (safe, has placeholders) |

## Security Notes

- ✅ `.env.test` is gitignored (never commit)
- ✅ Contains test-specific tokens (separate from dev)
- ✅ Each developer creates their own `.env.test`
- ✅ Use strong cryptographic tokens (64 chars)

## Quick Commands

```bash
# Generate new tokens
node -e "const c=require('crypto');console.log('JWT_SECRET='+c.randomBytes(32).toString('hex'));console.log('INTERNAL_API_TOKEN='+c.randomBytes(32).toString('hex'))"

# Check if .env.test is loaded
npx tsx src/test-runner/index.ts

# Run all tests
npm run test:validator

# Run specific test
./run_tests.sh qa/JRN-002-happy-signup-login-client-companion.json
```

## What Changed?

**Before:** Tests used development environment (`.env`)
**After:** Tests use dedicated test environment (`.env.test`)

**Benefits:**
- ✅ Separate test tokens from development
- ✅ No more 401 errors on internal endpoints
- ✅ Better security (tokens don't leak between environments)
- ✅ Each developer has their own test tokens

---

📖 **Full documentation:** See `TESTING.md` for complete testing guide
