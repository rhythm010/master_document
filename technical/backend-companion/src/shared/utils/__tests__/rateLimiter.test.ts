import { describe, test, expect, jest } from "@jest/globals";
import { EmailRateLimiter } from "../rateLimiter";

// Basic behavior tests for the in-memory email rate limiter.
describe("EmailRateLimiter", () => {
  // Verifies the limiter blocks after the maximum attempts.
  test("limits after max attempts", () => {
    const limiter = new EmailRateLimiter(2, 1000);
    expect(limiter.isLimited("test@example.com")).toBe(false);
    limiter.recordFailure("test@example.com");
    limiter.recordFailure("test@example.com");
    expect(limiter.isLimited("test@example.com")).toBe(true);
  });

  // Verifies the limiter resets after the window expires.
  test("resets after window expires", () => {
    jest.useFakeTimers();
    const limiter = new EmailRateLimiter(1, 1000);
    limiter.recordFailure("test@example.com");
    expect(limiter.isLimited("test@example.com")).toBe(true);

    jest.advanceTimersByTime(1001);
    expect(limiter.isLimited("test@example.com")).toBe(false);
    jest.useRealTimers();
  });
});
