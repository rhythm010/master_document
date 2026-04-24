import { EmailRateLimiter } from "../rateLimiter";

describe("EmailRateLimiter", () => {
  test("limits after max attempts", () => {
    const limiter = new EmailRateLimiter(2, 1000);
    expect(limiter.isLimited("test@example.com")).toBe(false);
    limiter.recordFailure("test@example.com");
    limiter.recordFailure("test@example.com");
    expect(limiter.isLimited("test@example.com")).toBe(true);
  });

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
