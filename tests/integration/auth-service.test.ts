import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { login, logout, refresh, revokeOtherSessions, listSessions, LOCKOUT_MS } from "@/server/services/auth";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { hashToken } from "@/server/auth/tokens";
import { AppError, UnauthenticatedError } from "@/server/errors";
import { makeUser } from "../support/factories";

const t0 = new Date("2026-03-15T12:00:00Z");
const at = (ms: number) => ({ now: new Date(t0.getTime() + ms) });
const GENERIC = "Email or password is incorrect";
const fail = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e as AppError);

describe("login", () => {
  it("issues an access token and a stored, hashed refresh token", async () => {
    const u = await makeUser("FINANCE");
    const s = await login({ email: u.email, password: u.password }, { ...at(0), ip: "1.2.3.4", userAgent: "vitest" });
    const claims = await verifyAccessToken(s.accessToken, t0);
    expect(claims).toMatchObject({ sub: u.id, role: "FINANCE" });
    const rows = await db.refreshToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tokenHash: hashToken(s.refreshToken), familyId: claims.sid, ip: "1.2.3.4", userAgent: "vitest" });
    expect(s.user).toEqual({ id: u.id, email: u.email, name: u.name, role: "FINANCE", studentId: null, isDemo: false });
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.lastLoginAt).toEqual(t0);
    expect(after.failedLoginCount).toBe(0);
  });

  it("normalises the email before looking it up", async () => {
    const u = await makeUser("REGISTRY_ADMIN", { email: "admin@x.com" });
    await expect(login({ email: "  ADMIN@x.com ", password: u.password }, at(0))).resolves.toBeTruthy();
  });

  it("gives the same message for unknown email, wrong password, inactive and unactivated accounts", async () => {
    const ok = await makeUser("FINANCE");
    const inactive = await makeUser("FINANCE", { isActive: false });
    const pending = await makeUser("ACADEMIC", { password: null });
    const errs = await Promise.all([
      fail(login({ email: "nobody@x.com", password: "whatever-123" }, at(0))),
      fail(login({ email: ok.email, password: "wrong-password" }, at(0))),
      fail(login({ email: inactive.email, password: inactive.password }, at(0))),
      fail(login({ email: pending.email, password: "anything-123" }, at(0))),
    ]);
    for (const e of errs) {
      expect(e).toBeInstanceOf(UnauthenticatedError);
      expect(e?.message).toBe(GENERIC);
    }
  });

  it("locks the account for 15 minutes after 5 failed attempts", async () => {
    const u = await makeUser("FINANCE");
    for (let i = 0; i < 5; i++) await fail(login({ email: u.email, password: "nope-nope-1" }, at(i)));
    const locked = await fail(login({ email: u.email, password: u.password }, at(10)));
    expect(locked?.status).toBe(429);
    expect(locked?.message).toMatch(/Try again in 15 minutes/);
    await expect(login({ email: u.email, password: u.password }, at(4 + LOCKOUT_MS + 1000))).resolves.toBeTruthy();
  });

  it("never locks a shared demo account", async () => {
    const u = await makeUser("REGISTRY_ADMIN", { isDemo: true });
    for (let i = 0; i < 10; i++) await fail(login({ email: u.email, password: "nope-nope-1" }, at(i)));
    await expect(login({ email: u.email, password: u.password }, at(20))).resolves.toBeTruthy();
  });
});

describe("refresh", () => {
  async function session() {
    const u = await makeUser("ACADEMIC");
    const s = await login({ email: u.email, password: u.password }, at(0));
    return { u, s };
  }

  it("rotates: revokes the presented token and issues a new one in the same family", async () => {
    const { s } = await session();
    const next = await refresh(s.refreshToken, at(1000));
    expect(next.refreshToken).not.toBe(s.refreshToken);
    const old = await db.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashToken(s.refreshToken) } });
    const fresh = await db.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashToken(next.refreshToken) } });
    expect(old.revokedAt).not.toBeNull();
    expect(old.replacedById).toBe(fresh.id);
    expect(fresh.familyId).toBe(old.familyId);
    expect((await verifyAccessToken(next.accessToken, at(1000).now)).sid).toBe(old.familyId);
  });

  it("tolerates two tabs refreshing at once (reuse within the 10 s grace window)", async () => {
    const { s } = await session();
    await refresh(s.refreshToken, at(1000));
    const second = await refresh(s.refreshToken, at(6000));
    expect(second.accessToken).toBeTruthy();
    expect(await db.refreshToken.count({ where: { revokedAt: null } })).toBeGreaterThan(0);
  });

  it("treats reuse after the grace window as theft and revokes the whole family", async () => {
    const { s } = await session();
    await refresh(s.refreshToken, at(1000));
    const err = await fail(refresh(s.refreshToken, at(12_000)));
    expect(err).toBeInstanceOf(UnauthenticatedError);
    expect(await db.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
  });

  it("rejects an expired refresh token", async () => {
    const { s } = await session();
    expect(await fail(refresh(s.refreshToken, at(7 * 86_400_000 + 1)))).toBeInstanceOf(UnauthenticatedError);
  });

  it("rejects refresh for a user deactivated since they logged in", async () => {
    const { u, s } = await session();
    await db.user.update({ where: { id: u.id }, data: { isActive: false } });
    expect(await fail(refresh(s.refreshToken, at(1000)))).toBeInstanceOf(UnauthenticatedError);
  });

  it("rejects an unknown token", async () => {
    expect(await fail(refresh("not-a-real-token", at(0)))).toBeInstanceOf(UnauthenticatedError);
  });
});

describe("logout & sessions", () => {
  it("revokes the session family and is idempotent", async () => {
    const u = await makeUser("FINANCE");
    const s = await login({ email: u.email, password: u.password }, at(0));
    await logout(s.refreshToken);
    await logout(s.refreshToken);
    await logout(undefined);
    expect(await fail(refresh(s.refreshToken, at(1000)))).toBeInstanceOf(UnauthenticatedError);
  });

  it("signs out other sessions but keeps the current one", async () => {
    const u = await makeUser("FINANCE");
    const a = await login({ email: u.email, password: u.password }, at(0));
    await login({ email: u.email, password: u.password }, at(1));
    await login({ email: u.email, password: u.password }, at(2));
    const current = (await verifyAccessToken(a.accessToken, t0)).sid;
    expect((await listSessions(u.id, current, at(3).now)).filter((x) => x.current)).toHaveLength(1);
    expect(await revokeOtherSessions(u.id, current)).toBe(2);
    await expect(refresh(a.refreshToken, at(1000))).resolves.toBeTruthy();
    expect(await listSessions(u.id, current, at(2000).now)).toHaveLength(1);
  });
});
