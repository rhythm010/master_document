type Entry = {
  count: number;
  resetAt: number;
};

export class EmailRateLimiter {
  private maxAttempts: number;
  private windowMs: number;
  private entries = new Map<string, Entry>();

  constructor(maxAttempts: number, windowMs: number) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isLimited(key: string) {
    const entry = this.getEntry(key);
    if (!entry) {
      return false;
    }

    return entry.count >= this.maxAttempts;
  }

  recordFailure(key: string) {
    const now = Date.now();
    const entry = this.getEntry(key);
    if (!entry) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }

    entry.count += 1;
    this.entries.set(key, entry);
  }

  reset(key: string) {
    this.entries.delete(key);
  }

  private getEntry(key: string) {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.resetAt) {
      this.entries.delete(key);
      return null;
    }

    return entry;
  }
}
