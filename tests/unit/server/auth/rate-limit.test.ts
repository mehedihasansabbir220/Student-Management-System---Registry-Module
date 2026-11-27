import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/server/auth/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit within the window, then blocks with a retry hint", () => {
    const rl = createRateLimiter({ limit: 20, windowMs: 900_000 });
    for (let i = 0; i < 20; i++) expect(rl.hit("1.2.3.4", 1000 + i).allowed).toBe(true);
    const blocked = rl.hit("1.2.3.4", 2000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("allows again once the window has passed", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.hit("k", 0).allowed).toBe(true);
    expect(rl.hit("k", 500).allowed).toBe(false);
    expect(rl.hit("k", 1001).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.hit("a", 0).allowed).toBe(true);
    expect(rl.hit("b", 0).allowed).toBe(true);
  });
});
