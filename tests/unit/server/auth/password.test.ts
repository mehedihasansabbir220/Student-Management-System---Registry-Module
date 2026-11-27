import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("password hashing (scrypt)", () => {
  it("verifies the right password", async () => {
    const stored = await hashPassword("Correct-Horse-1");
    await expect(verifyPassword("Correct-Horse-1", stored)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const stored = await hashPassword("Correct-Horse-1");
    await expect(verifyPassword("correct-horse-1", stored)).resolves.toBe(false);
  });

  it("salts every hash, so equal passwords give different hashes", async () => {
    expect(await hashPassword("same-password")).not.toBe(await hashPassword("same-password"));
  });

  it("stores algorithm parameters alongside the hash", async () => {
    expect(await hashPassword("whatever-123")).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });

  it("returns false (never throws) for a malformed stored value", async () => {
    await expect(verifyPassword("x", "garbage")).resolves.toBe(false);
    await expect(verifyPassword("x", "scrypt$1$2$3$!!$??")).resolves.toBe(false);
  });
});
