/**
 * Minimal in-memory failure throttle (per process). Good enough to blunt online password
 * guessing against a single self-hosted instance; not a distributed rate limiter.
 */
interface Bucket {
  failures: number;
  resetAt: number;
}

export class FailureThrottle {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly maxKeys = 5000
  ) {}

  /** Seconds the caller must wait before retrying, or 0 when allowed. */
  retryAfterSeconds(key: string, now = Date.now()): number {
    const b = this.buckets.get(key);
    if (!b) return 0;
    if (b.resetAt <= now) {
      this.buckets.delete(key);
      return 0;
    }
    return b.failures >= this.maxFailures ? Math.ceil((b.resetAt - now) / 1000) : 0;
  }

  recordFailure(key: string, now = Date.now()): void {
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      if (this.buckets.size >= this.maxKeys) this.prune(now);
      this.buckets.set(key, { failures: 1, resetAt: now + this.windowMs });
    } else {
      b.failures++;
    }
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private prune(now: number): void {
    for (const [k, v] of this.buckets) if (v.resetAt <= now) this.buckets.delete(k);
    // Still full of live entries: drop the oldest insertion to stay bounded.
    if (this.buckets.size >= this.maxKeys) {
      const first = this.buckets.keys().next().value;
      if (first !== undefined) this.buckets.delete(first);
    }
  }
}
