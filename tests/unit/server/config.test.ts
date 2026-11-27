import { afterEach, describe, expect, it, vi } from "vitest";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  vi.resetModules();
});

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...saved, DATABASE_URL: "postgresql://x", ...env };
  const { config } = await import("@/server/config");
  return config;
}

describe("config", () => {
  it("fails fast when JWT_SECRET is missing or weak", async () => {
    const config = await load({ JWT_SECRET: "short" });
    expect(() => config()).toThrow(/JWT_SECRET/);
  });

  it("reads demo settings with safe defaults", async () => {
    const config = await load({ JWT_SECRET: "x".repeat(32), DEMO_MODE: undefined, DEMO_PASSWORD: undefined });
    expect(config()).toMatchObject({ demoMode: false, demoPassword: "Demo@12345" });
  });

  it("enables demo mode only for the literal 'true'", async () => {
    expect((await load({ JWT_SECRET: "x".repeat(32), DEMO_MODE: "true" }))().demoMode).toBe(true);
    expect((await load({ JWT_SECRET: "x".repeat(32), DEMO_MODE: "yes" }))().demoMode).toBe(false);
  });
});
