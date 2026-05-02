import os from "node:os";

/**
 * Test runner configuration
 * This file contains local-only configuration for test execution optimization
 */
export const config = {
  environment: {
    nodeEnv: process.env.NODE_ENV || "development",
  },
  api: {
    baseUrl: process.env.API_BASE_URL || "http://localhost:3000",
  },
  mailpit: {
    baseUrl: process.env.MAILPIT_BASE_URL || "http://localhost:8025",
    // PERFORMANCE: Reduced from 200ms for local testing - emails are available within milliseconds on localhost
    pollIntervalMs: 50,
    // PERFORMANCE: Reduced from 1000ms for local testing - aggressive polling is safe for local Mailpit
    maxPollIntervalMs: 200,
    // PERFORMANCE: Reduced from 2.5 for faster backoff - reduces worst-case email verification from 8-10s to 1-2s
    backoffMultiplier: 1.5,
    // PERFORMANCE: Reduced from 30s for local testing - tests should not wait this long
    maxWaitSeconds: 5,
  },
  database: {
    poolSize: Number(process.env.DB_POOL_SIZE) || 10,
    poolMaxIdleTimeMs: 30000,
  },
  execution: {
    concurrency: Number(process.env.TEST_RUNNER_CONCURRENCY) || Math.max(1, os.cpus().length - 1),
    maxConcurrency: 16,
  },
};
