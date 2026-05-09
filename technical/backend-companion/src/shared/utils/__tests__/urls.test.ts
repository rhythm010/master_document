import { describe, expect, test, jest } from "@jest/globals";

type EnvSnapshot = Record<string, string | undefined>;

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

function loadBuildVerifyEmailLinks() {
  jest.resetModules();
  return require("../urls").buildVerifyEmailLinks as (token: string) => {
    deepLink: string;
    webLink: string;
  };
}

describe("shared/utils/urls", () => {
  const envKeys = [
    "NODE_ENV",
    "APP_ENV",
    "DATABASE_URL",
    "JWT_SECRET",
    "INTERNAL_API_TOKEN",
    "MOBILE_DEEPLINK_SCHEME",
    "WEB_VERIFY_URL"
  ];

  test("URL-encodes verification token for both deepLink and webLink", () => {
    const snapshot = snapshotEnv(envKeys);
    try {
      setRequiredEnv();
      process.env.NODE_ENV = "test";
      delete process.env.APP_ENV;
      process.env.MOBILE_DEEPLINK_SCHEME = "companion-dev://";
      process.env.WEB_VERIFY_URL = "https://example.com/verify-email?token={token}";

      const buildVerifyEmailLinks = loadBuildVerifyEmailLinks();

      const token = "a+b c/=?&%";
      const encoded = encodeURIComponent(token);

      const { deepLink, webLink } = buildVerifyEmailLinks(token);
      expect(deepLink).toBe(`companion-dev://auth/verify-email?token=${encoded}`);
      expect(webLink).toBe(`https://example.com/verify-email?token=${encoded}`);
    } finally {
      restoreEnv(snapshot);
    }
  });
});
