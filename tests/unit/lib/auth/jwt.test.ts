import { afterEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { ACCESS_TTL_SECONDS, TokenError, jwtSecret, signAccessToken, verifyAccessToken } from "@/lib/auth/jwt";

const claims = { sub: "user_1", role: "FINANCE" as const, sid: "fam_1", studentId: undefined };
const now = new Date("2026-03-15T12:00:00Z");
const later = (s: number) => new Date(now.getTime() + s * 1000);
const original = process.env.JWT_SECRET;
afterEach(() => {
  process.env.JWT_SECRET = original;
});

const reason = (p: Promise<unknown>) => p.then(() => "ok", (e: unknown) => (e instanceof TokenError ? e.reason : `other:${String(e)}`));

describe("access tokens", () => {
  it("round-trips the claims", async () => {
    const token = await signAccessToken({ ...claims, studentId: "stu_1", demo: true }, now);
    await expect(verifyAccessToken(token, later(1))).resolves.toMatchObject({ sub: "user_1", role: "FINANCE", sid: "fam_1", studentId: "stu_1", demo: true });
  });

  it("lives 15 minutes", async () => {
    expect(ACCESS_TTL_SECONDS).toBe(900);
    const token = await signAccessToken(claims, now);
    await expect(verifyAccessToken(token, later(899))).resolves.toBeTruthy();
    expect(await reason(verifyAccessToken(token, later(901)))).toBe("expired");
  });

  it("rejects a token signed with a different secret", async () => {
    process.env.JWT_SECRET = "another-secret-another-secret-another!!";
    const token = await signAccessToken(claims, now);
    process.env.JWT_SECRET = original;
    expect(await reason(verifyAccessToken(token, later(1)))).toBe("invalid");
  });

  it("rejects a token whose payload was tampered with", async () => {
    const [h, , s] = (await signAccessToken(claims, now)).split(".");
    const forged = Buffer.from(JSON.stringify({ ...claims, role: "REGISTRY_ADMIN", exp: 9999999999 })).toString("base64url");
    expect(await reason(verifyAccessToken(`${h}.${forged}.${s}`, later(1)))).toBe("invalid");
  });

  it("rejects an unsigned alg:none token", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ ...claims, iss: "sms-registry", aud: "sms-web", exp: 9999999999 })).toString("base64url");
    expect(await reason(verifyAccessToken(`${header}.${body}.`, later(1)))).toBe("invalid");
  });

  it("rejects a token for a different audience", async () => {
    const token = await new SignJWT({ role: "FINANCE", sid: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_1")
      .setIssuer("sms-registry")
      .setAudience("someone-else")
      .setIssuedAt(Math.floor(now.getTime() / 1000))
      .setExpirationTime(Math.floor(now.getTime() / 1000) + 900)
      .sign(jwtSecret());
    expect(await reason(verifyAccessToken(token, later(1)))).toBe("invalid");
  });

  it("rejects garbage", async () => {
    expect(await reason(verifyAccessToken("not.a.jwt", later(1)))).toBe("invalid");
  });

  it("refuses to run with a weak secret", () => {
    process.env.JWT_SECRET = "short";
    expect(() => jwtSecret()).toThrow(/at least 32/);
  });
});
