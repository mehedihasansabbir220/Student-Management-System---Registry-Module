import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { activate, changePassword, createActivationToken, issueActivationLink, login } from "@/server/services/auth";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { AppError, BusinessRuleError, ValidationError } from "@/server/errors";
import { STAFF, makeProgramme, makeStudent, makeStudentUser, makeUser } from "../support/factories";

const t0 = new Date("2026-03-15T12:00:00Z");
const at = (ms: number) => ({ now: new Date(t0.getTime() + ms) });
const fail = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e as AppError);

async function pendingStudentUser() {
  const s = await makeStudent((await makeProgramme()).id);
  const u = await makeStudentUser(s.id, { password: null });
  const token = await db.$transaction((tx) => createActivationToken(tx, u.id, t0));
  return { s, u, token };
}

describe("activate", () => {
  it("sets the password, consumes the link and signs the user in", async () => {
    const { u, token } = await pendingStudentUser();
    const session = await activate({ token, password: "My-New-Password-1" }, at(1000));
    expect(session.user.id).toBe(u.id);
    expect((await db.activationToken.findFirstOrThrow({ where: { userId: u.id } })).usedAt).not.toBeNull();
    await expect(login({ email: u.email, password: "My-New-Password-1" }, at(2000))).resolves.toBeTruthy();
  });

  it("refuses a link that was already used", async () => {
    const { token } = await pendingStudentUser();
    await activate({ token, password: "My-New-Password-1" }, at(1000));
    const err = await fail(activate({ token, password: "Another-Password-1" }, at(2000)));
    expect(err).toBeInstanceOf(BusinessRuleError);
    expect(err?.message).toMatch(/already been used/);
  });

  it("refuses an expired link (72 hours)", async () => {
    const { token } = await pendingStudentUser();
    const err = await fail(activate({ token, password: "My-New-Password-1" }, at(72 * 3_600_000 + 1000)));
    expect(err?.message).toMatch(/expired/);
  });

  it("refuses an unknown link", async () => {
    expect(await fail(activate({ token: "nope", password: "My-New-Password-1" }, at(0)))).toBeInstanceOf(BusinessRuleError);
  });

  it("refuses a password equal to the email", async () => {
    const { u, token } = await pendingStudentUser();
    const err = await fail(activate({ token, password: u.email }, at(0)));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err?.fields).toHaveProperty("password");
  });
});

describe("changePassword", () => {
  it("rejects a wrong current password on that field", async () => {
    const u = await makeUser("FINANCE");
    const err = await fail(changePassword(u.id, { currentPassword: "wrong", newPassword: "Brand-New-Pass-1" }, "fam"));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err?.fields).toHaveProperty("currentPassword");
  });

  it("changes the password and signs out every other session", async () => {
    const u = await makeUser("FINANCE");
    const a = await login({ email: u.email, password: u.password }, at(0));
    await login({ email: u.email, password: u.password }, at(1));
    const sid = (await verifyAccessToken(a.accessToken, t0)).sid;
    const res = await changePassword(u.id, { currentPassword: u.password, newPassword: "Brand-New-Pass-1" }, sid);
    expect(res.revokedSessions).toBe(1);
    await expect(login({ email: u.email, password: "Brand-New-Pass-1" }, at(5))).resolves.toBeTruthy();
    expect(await fail(login({ email: u.email, password: u.password }, at(6)))).not.toBeNull();
  });

  it("is not allowed on a shared demo account", async () => {
    const u = await makeUser("REGISTRY_ADMIN", { isDemo: true });
    const err = await fail(changePassword(u.id, { currentPassword: u.password, newPassword: "Brand-New-Pass-1" }, "fam"));
    expect(err).toBeInstanceOf(BusinessRuleError);
    expect(err?.message).toMatch(/demo account/i);
  });
});

describe("issueActivationLink", () => {
  it("issues a fresh link and invalidates older unused ones", async () => {
    const { s, token: old } = await pendingStudentUser();
    const fresh = await issueActivationLink(s.id, STAFF);
    expect(await fail(activate({ token: old, password: "My-New-Password-1" }, at(0)))).toBeInstanceOf(BusinessRuleError);
    await expect(activate({ token: fresh, password: "My-New-Password-1" })).resolves.toBeTruthy();
    expect(await db.auditLog.count({ where: { action: "account.activation_issued", studentId: s.id } })).toBe(1);
  });

  it("refuses for an account that is already active", async () => {
    const s = await makeStudent((await makeProgramme()).id);
    await makeStudentUser(s.id);
    expect(await fail(issueActivationLink(s.id, STAFF))).toBeInstanceOf(BusinessRuleError);
  });
});
