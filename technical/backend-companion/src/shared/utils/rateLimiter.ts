type Entry = {
  count: number;
  resetAt: number;
};

export class EmailRateLimiter {
  private maxAttempts: number;
  private windowMs: number;
  private entries = new Map<string, Entry>();

  // Initialize the limiter with a max attempt count and rolling window.
  constructor(maxAttempts: number, windowMs: number) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  // Return true when the key has exceeded the allowed attempts.
  isLimited(key: string) {
    const entry = this.getEntry(key);
    if (!entry) {
      return false;
    }

    return entry.count >= this.maxAttempts;
  }

  // Record a failed attempt for the given key.
  recordFailure(key: string) {
    const now = Date.now();
    const entry = this.getEntry(key);
    if (!entry) {
      // Start a new window on the first failure.
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }

    // Increment within the active window.
    entry.count += 1;
    this.entries.set(key, entry);
  }

  // Clear all attempts for the given key.
  reset(key: string) {
    this.entries.delete(key);
  }

  // Return a valid entry or null when missing/expired.
  private getEntry(key: string) {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    // Drop expired windows and treat them as missing.
    if (Date.now() > entry.resetAt) {
      this.entries.delete(key);
      return null;
    }

    return entry;
  }
}
