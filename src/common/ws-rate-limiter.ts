type WindowEntry = { count: number; resetAt: number };

/**
 * Fixed-window limiter for socket events, keyed by authenticated user ID so
 * opening several sockets doesn't multiply the allowance. In-memory: limits are
 * per backend instance.
 */
export class WsRateLimiter {
  private readonly windows = new Map<string, WindowEntry>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string): boolean {
    const now = Date.now();
    const entry = this.windows.get(key);

    if (!entry || entry.resetAt <= now) {
      this.pruneExpired(now);
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.limit) return false;

    entry.count += 1;
    return true;
  }

  private pruneExpired(now: number): void {
    for (const [key, entry] of this.windows) {
      if (entry.resetAt <= now) this.windows.delete(key);
    }
  }
}
