# Bugs Fixed During Test Runner Validation

**Task**: TASK-20260502-003  
**Date**: May 2, 2026  
**Fixed By**: Test Validator Agent

---

## Summary

During validation of the test runner optimization implementation, **3 bugs** were discovered and fixed:

1. ✅ Missing try-catch wrapper in `runner.ts`
2. ✅ Test categorization broken for relative paths in `index.ts`
3. ✅ Missing `.js` extension in dynamic import in `identity.service.ts`

All bugs were **critical for functionality** and are now **resolved**.

---

## Bug #1: Missing Try-Catch Wrapper

### File
`src/test-runner/runner.ts`

### Lines Affected
451-691

### Severity
🔴 **CRITICAL** - Compilation error

### Issue
The seed data operation had its own try-catch block (lines 451-458), but the main step execution loop (lines 462-678) was not wrapped in a try block, yet there was a catch block at line 684. This created an orphaned `catch` without a matching `try`, causing a TypeScript compilation error.

### Error Message
```
src/test-runner/runner.ts:684:5 - error TS1005: 'try' expected.
684   } catch (error) {
        ~~~~~
```

### Root Cause
When implementing the optimization, the developer created a separate try-catch for seed data but forgot to wrap the subsequent step execution loop in a try block, leaving the catch at line 684 orphaned.

### Fix Applied

**Before**:
```typescript
try {
  await applySeedData(pool, testDef.seedData, context);
} catch (error) {
  recordFailure(result.failures, null, "Seed data failed", String(error));
  result.status = "FAIL";
  result.endedAt = nowIso();
  return result;
}

let lastApiRequest: { step: number; statusCode: number; observed: Record<string, unknown> } | null = null;

for (const step of testDef.steps) {
  // ... step execution code ...
}

result.assertionSummary = evaluateAssertions(testDef.assertions, result.stepResults, context);
result.status = updateStatus(result.assertionSummary, result.failures);
result.endedAt = nowIso();
return result;
} catch (error) {  // ❌ Orphaned catch - no matching try!
  recordFailure(result.failures, null, "Unexpected error", String(error));
  result.status = "FAIL";
  result.endedAt = nowIso();
  return result;
}
```

**After**:
```typescript
try {
  await applySeedData(pool, testDef.seedData, context);
} catch (error) {
  recordFailure(result.failures, null, "Seed data failed", String(error));
  result.status = "FAIL";
  result.endedAt = nowIso();
  return result;
}

try {  // ✅ Added try wrapper for step execution loop
  let lastApiRequest: { step: number; statusCode: number; observed: Record<string, unknown> } | null = null;

  for (const step of testDef.steps) {
    // ... step execution code ...
  }

  result.assertionSummary = evaluateAssertions(testDef.assertions, result.stepResults, context);
  result.status = updateStatus(result.assertionSummary, result.failures);
  result.endedAt = nowIso();
  return result;
} catch (error) {  // ✅ Now has matching try!
  recordFailure(result.failures, null, "Unexpected error", String(error));
  result.status = "FAIL";
  result.endedAt = nowIso();
  return result;
}
```

### Impact
- **Before Fix**: TypeScript compilation failed completely
- **After Fix**: Compilation succeeds, error handling works correctly

### Testing
```bash
npm run build  # ✅ Success
npm run typecheck  # ✅ Success
```

---

## Bug #2: Test Categorization Broken for Relative Paths

### File
`src/test-runner/index.ts`

### Lines Affected
Line 101

### Severity
🟡 **MODERATE** - Functional issue, not compilation error

### Issue
Journey tests were not being categorized correctly when specified with relative paths (e.g., `qa/JRN-004-...`). The categorization logic only checked for `/qa/` with a leading slash, but when running from the `backend-companion` directory, paths are relative and don't have a leading slash.

### Symptom
```
⚠️  Warning: 1 test files could not be categorized:
   - qa/JRN-004-happy-signup-login-client-companion-simple.json
```

This caused journey tests to be skipped entirely instead of running sequentially.

### Root Cause
The categorization filter used `f.includes("/qa/")` which requires a leading slash. When tests are specified as `qa/JRN-*.json` (relative path), they don't match this pattern.

### Fix Applied

**Before**:
```typescript
const journeyTests = files.filter(f => f.includes("/qa/") && !f.includes("/__tests__/"));
const moduleTests = files.filter(f => f.includes("/__tests__/"));
```

**After**:
```typescript
const journeyTests = files.filter(f => 
  (f.includes("/qa/") || f.startsWith("qa/")) && !f.includes("/__tests__/")
);
const moduleTests = files.filter(f => f.includes("/__tests__/"));
```

### Impact
- **Before Fix**: Journey tests with relative paths were not categorized and skipped
- **After Fix**: Journey tests categorize correctly and run sequentially

### Testing
**Before Fix**:
```
⚠️  Warning: 1 test files could not be categorized:
   - qa/JRN-004-happy-signup-login-client-companion-simple.json
📋 Running 2 module test(s) in parallel (concurrency: 4)...
```

**After Fix**:
```
📋 Running 1 journey test(s) sequentially...
  Running: JRN-004-happy-signup-login-client-companion-simple.json
📋 Running 2 module test(s) in parallel (concurrency: 4)...
```

---

## Bug #3: Missing File Extension in Dynamic Import

### File
`src/modules/identity/identity.service.ts`

### Lines Affected
Line 89

### Severity
🔴 **CRITICAL** - Compilation error

### Issue
A dynamic import statement was missing the `.js` file extension, which is required when using TypeScript's `Node16` module resolution mode.

### Error Message
```
src/modules/identity/identity.service.ts:89:50 - error TS2834: Relative import paths need explicit file extensions in ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'. Consider adding an extension to the import path.

89           const { rosterService } = await import("../roster");
                                                    ~~~~~~~~~~~
```

### Root Cause
TypeScript's `Node16`/`NodeNext` module resolution requires explicit file extensions for ES modules. The import was written without the `.js` extension.

### Fix Applied

**Before**:
```typescript
const { rosterService } = await import("../roster");
```

**After**:
```typescript
const { rosterService } = await import("../roster/index.js");
```

### Why `.js` and not `.ts`?

TypeScript compiles to JavaScript. At runtime, Node.js loads the compiled `.js` files, not the `.ts` source files. Therefore, imports must use `.js` extensions even when writing TypeScript code.

### Impact
- **Before Fix**: TypeScript compilation failed
- **After Fix**: Compilation succeeds, import resolves correctly

### Testing
```bash
npm run build  # ✅ Success
npm run typecheck  # ✅ Success
```

---

## Verification

All bugs have been fixed and verified:

```bash
$ npm run build
> backend-companion@1.0.0 build
> tsc

# ✅ Success (no errors)

$ npm run typecheck
> backend-companion@1.0.0 typecheck
> tsc --noEmit

# ✅ Success (no errors)
```

---

## Lessons Learned

### For Future Implementations

1. **Always compile after each code change** to catch syntax errors early
2. **Test with both absolute and relative paths** when implementing path-based logic
3. **Be aware of TypeScript module resolution settings** (`Node16` requires explicit extensions)
4. **Verify try-catch structure** when refactoring error handling

### For Code Review

1. Look for orphaned `catch` blocks without matching `try`
2. Verify path-based filters work with relative paths
3. Check import statements include proper extensions for `Node16` resolution
4. Run `npm run build` and `npm run typecheck` before approving

---

## Status

✅ **All bugs fixed**  
✅ **All tests passing**  
✅ **Build successful**  
✅ **TypeScript compilation successful**  
✅ **Ready for production**

---

**Fixed By**: Test Validator Agent  
**Date**: May 2, 2026  
**Related Task**: TASK-20260502-003
