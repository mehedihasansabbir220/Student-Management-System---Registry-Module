import { describe, expect, it } from "vitest";
import { generateOpaqueToken, hashToken } from "@/server/auth/tokens";

describe("opaque tokens", () => {
  it("are 32 random bytes encoded as base64url (43 chars)", () => {
    const t = generateOpaqueToken();
    expect(t).toHaveLength(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("are unique", () => {
    expect(new Set(Array.from({ length: 100 }, generateOpaqueToken)).size).toBe(100);
  });

  it("are stored as a SHA-256 hex digest, never raw", () => {
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
