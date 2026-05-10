# FE Test Validation Report

**Run ID:** FE-RUN-20260510-094322-FE-M01-FOUNDATION-001  
**Date:** 2026-05-10  
**Status:** ❌ FAIL  

---

## Test Details

| Field | Value |
|---|---|
| Test ID | FE-M01-FOUNDATION-001-no-session-to-login |
| Title | Fresh start with no persisted token redirects to login stub screen |
| Design File | `e2e/designs/FE-M01-FOUNDATION-001-no-session-to-login.json` |
| Generated Spec | `e2e/generated/FE-M01-FOUNDATION-001-no-session-to-login.spec.ts` |
| Runtime | Chromium (Playwright v1.59.1) |

---

## Preflight

| Check | Status |
|---|---|
| Frontend server (http://localhost:8081) | ✅ PASS (HTTP 200, already running) |
| Backend server | ⏭ SKIPPED (requiredBackend: false) |

---

## Journey Step Results

| Step | Action | Status | Notes |
|---|---|---|---|
| 1 | openApp (route: /) | ✅ PASS | Page loaded, domcontentloaded fired |
| 2 | waitForRoute (/login, 5000ms) | ❌ FAIL | URL stayed at http://localhost:8081/ — runtime crash prevented redirect |
| 3 | waitForText ("Login") | ⛔ NOT REACHED | — |

---

## Assertion Results

| # | After Step | Type | Expected | Status |
|---|---|---|---|---|
| 1 | 2 | routeContains | "login" | ❌ FAIL |
| 2 | 3 | uiVisible | text: "Login" | ⛔ NOT REACHED |
| 3 | 3 | uiNotVisible | text: "Client Home" | ⛔ NOT REACHED |
| 4 | 3 | uiNotVisible | text: "Companion Home" | ⛔ NOT REACHED |

**Assertions passed: 0 / 4**

---

## Root Cause

**Uncaught Runtime Error on page load:**

```
ExpoSecureStore.default.getValueWithKeyAsync is not a function
```

**Traced to:** `store/session.ts:39` — `SecureStore.getItemAsync(TOKEN_KEY)`

**Call stack:**
1. `readPersistedToken` (store/session.ts:39)
2. `restore` (app/index.tsx:15)
3. `React.useEffect` (app/index.tsx:35)

**What happens:** `expo-secure-store`'s `getItemAsync` internally calls `getValueWithKeyAsync`, which does not exist in the web platform build. This causes an uncaught exception that crashes the session restore flow **before** `router.replace('/(auth)/login')` can execute.

**Evidence:** Screenshot captured at `test-results/.../test-failed-1.png` shows the Expo error overlay with the exact error message and call stack.

---

## Failure Classification

| Field | Value |
|---|---|
| Failure Owner | **frontend** |
| Affected File | `store/session.ts` |
| Line | 39 |
| Bug Type | `expo-secure-store` web-platform incompatibility |

---

## Suggested Fix (for Coding Agent)

Wrap `SecureStore.getItemAsync` in a `try/catch` inside `readPersistedToken` so that if the SecureStore web polyfill throws, the function returns `null` and the redirect to `/login` can proceed normally:

```typescript
export async function readPersistedToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}
```

Alternatively, add a web-safe localStorage fallback using `Platform.OS === 'web'` before calling SecureStore.

---

## Next Action

Route this report to the **Coding Agent** to fix `store/session.ts:readPersistedToken`.  
Re-run this validation after the fix is applied.
