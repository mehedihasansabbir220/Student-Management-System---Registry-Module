import "server-only";

/**
 * Fixed-window, in-memory rate limiter.
 * Good enough for a single server instance; with several instances this
 * moves to Redis (documented in the README/ADR) — the interface stays the same.
 */
export function createRateLimiter(opts: { limit: number; windowMs: number }) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  function prune(now: number) {
    if (buckets.size < 10_000) return;
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  }

  return {
    hit(key: string, now = Date.now()): { allowed: boolean; retryAfterMs: number } {
      prune(now);
      const b = buckets.get(key);
      if (!b || b.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
        return { allowed: true, retryAfterMs: 0 };
      }
      b.count += 1;
      return b.count <= opts.limit ? { allowed: true, retryAfterMs: 0 } : { allowed: false, retryAfterMs: b.resetAt - now };
    },
  };
}

/** 20 login attempts per IP per 15 minutes (on top of per-account lockout). */
export const loginLimiter = createRateLimiter({ limit: 20, windowMs: 15 * 60_000 });
