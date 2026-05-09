import { describe, expect, test, jest } from "@jest/globals";

type EnvSnapshot = Record<string, string | undefined>;

// Capture and restore env across tests to avoid cross-test pollution.
function snapshotEnv(keys: string[]): EnvSnapshot {
  const snapshot: EnvSnapshot = {};
  for (const key of keys) snapshot[key] = process.env[key];
  return snapshot;
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function setRequiredEnv() {
  process.env.DATABASE_URL ??=
    "postgresql://companion:companion@localhost:5432/companion_test?schema=public";
  process.env.JWT_SECRET ??= "test-jwt-secret-32-characters-min!!";
  process.env.INTERNAL_API_TOKEN ??= "test-internal-token";
}

// Load config fresh after env changes.
function loadConfig() {
  jest.resetModules();
  return require("../index").config as { mobileDeepLinkScheme: string; emailDeliveryMode: string };
}

describe("shared/config", () => {
  const envKeys = [
    "NODE_ENV",
    "APP_ENV",
    "DATABASE_URL",
    "JWT_SECRET",
    "INTERNAL_API_TOKEN",
    "MOBILE_DEEPLINK_SCHEME",
    "WEB_VERIFY_URL",
    "EMAIL_DELIVERY_MODE"
  ];

  test("fails fast when NODE_ENV=production and APP_ENV is missing", () => {
    const snapshot = snapshotEnv(envKeys);
    try {
      setRequiredEnv();
      process.env.NODE_ENV = "production";
      delete process.env.APP_ENV;

      expect(() => loadConfig()).toThrow(
        /APP_ENV must be explicitly set to 'staging' or 'production' when NODE_ENV=production/
      );
    } finally {
      restoreEnv(snapshot);
    }
  });

  test("fails fast when NODE_ENV=production and APP_ENV is local/dev", () => {
    const snapshot = snapshotEnv(envKeys);
    try {
      setRequiredEnv();
      process.env.NODE_ENV = "production";
      process.env.APP_ENV = "local";

      expect(() => loadConfig()).toThrow(/APP_ENV must be either 'staging' or 'production'/);
    } finally {
      restoreEnv(snapshot);
    }
  });

  test("defaults email delivery mode to log_only for staging", () => {
    const snapshot = snapshotEnv(envKeys);
    try {
      setRequiredEnv();
      process.env.NODE_ENV = "production";
      process.env.APP_ENV = "staging";
      delete process.env.EMAIL_DELIVERY_MODE;

      const config = loadConfig();
      expect(config.emailDeliveryMode).toBe("log_only");
    } finally {
      restoreEnv(snapshot);
    }
  });

  test("treats empty MOBILE_DEEPLINK_SCHEME as invalid", () => {
    const snapshot = snapshotEnv(envKeys);
    try {
      setRequiredEnv();
      process.env.NODE_ENV = "test";
      delete process.env.APP_ENV;
      process.env.MOBILE_DEEPLINK_SCHEME = "   ";

      expect(() => loadConfig()).toThrow(/MOBILE_DEEPLINK_SCHEME cannot be empty/);
    } finally {
      restoreEnv(snapshot);
    }
  });

  test("normalizes MOBILE_DEEPLINK_SCHEME to canonical <scheme>://", () => {
    const snapshot = snapshotEnv(envKeys);
    try {
      setRequiredEnv();
      process.env.NODE_ENV = "test";
      delete process.env.APP_ENV;
      process.env.MOBILE_DEEPLINK_SCHEME = "Companion-DEV:";

      const config = loadConfig();
      expect(config.mobileDeepLinkScheme).toBe("companion-dev://");
    } finally {
      restoreEnv(snapshot);
    }
  });

  test("requires WEB_VERIFY_URL to include {token} placeholder", () => {
    const snapshot = snapshotEnv(envKeys);
    try {
      setRequiredEnv();
      process.env.NODE_ENV = "test";
      delete process.env.APP_ENV;
      process.env.WEB_VERIFY_URL = "https://example.com/verify-email";

      expect(() => loadConfig()).toThrow(/WEB_VERIFY_URL must contain the '\{token\}' placeholder/);
    } finally {
      restoreEnv(snapshot);
    }
  });
});
