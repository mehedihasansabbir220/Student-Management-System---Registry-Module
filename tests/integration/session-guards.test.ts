import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { requirePermission, requireStudent, requireUser } from "@/server/session";
import { ACCESS_COOKIE } from "@/server/auth/cookies";
import { signAccessToken } from "@/lib/auth/jwt";
import { ForbiddenError, TokenExpiredError, UnauthenticatedError } from "@/server/errors";
import { makeProgramme, makeStudent, makeStudentUser, makeUser } from "../support/factories";

function req(token?: string) {
  const headers = new Headers();
  if (token) headers.set("cookie", `${ACCESS_COOKIE}=${token}`);
  return new NextRequest("http://localhost/api/x", { headers });
}

async function tokenFor(u: { id: string; role: "REGISTRY_ADMIN" | "FINANCE" | "ACADEMIC" | "STUDENT"; studentId?: string | null }, now = new Date()) {
  return signAccessToken({ sub: u.id, role: u.role, sid: "fam_1", studentId: u.studentId ?? undefined }, now);
}

const fail = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);

describe("request guards", () => {
  it("rejects a request with no session", async () => {
    expect(await fail(requireUser(req()))).toBeInstanceOf(UnauthenticatedError);
  });

  it("asks the client to refresh when the access token has expired", async () => {
    const u = await makeUser("FINANCE");
    const err = await fail(requireUser(req(await tokenFor(u, new Date(Date.now() - 16 * 60_000)))));
    expect(err).toBeInstanceOf(TokenExpiredError);
    expect((err as TokenExpiredError).code).toBe("TOKEN_EXPIRED");
  });

  it("rejects a tampered token as unauthenticated (not a 500)", async () => {
    const u = await makeUser("FINANCE");
    const [h, , s] = (await tokenFor(u)).split(".");
    const forged = Buffer.from(JSON.stringify({ sub: u.id, role: "REGISTRY_ADMIN", sid: "x" })).toString("base64url");
    expect(await fail(requireUser(req(`${h}.${forged}.${s}`)))).toBeInstanceOf(UnauthenticatedError);
  });

  it("rejects a valid token for a user who has since been deactivated", async () => {
    const u = await makeUser("FINANCE");
    const token = await tokenFor(u);
    await db.user.update({ where: { id: u.id }, data: { isActive: false } });
    expect(await fail(requireUser(req(token)))).toBeInstanceOf(UnauthenticatedError);
  });

  it("returns the current user with an auditable actor", async () => {
    const u = await makeUser("ACADEMIC", { email: "dr.x@example.com", name: "Dr X" });
    await expect(requireUser(req(await tokenFor(u)))).resolves.toMatchObject({
      userId: u.id,
      role: "ACADEMIC",
      name: "Dr X",
      email: "dr.x@example.com",
      actor: "user:dr.x@example.com",
      sessionId: "fam_1",
      isDemo: false,
      studentId: null,
    });
  });

  it("enforces the permission matrix", async () => {
    const u = await makeUser("FINANCE");
    expect(await fail(requirePermission(req(await tokenFor(u)), "grades.write"))).toBeInstanceOf(ForbiddenError);
    await expect(requirePermission(req(await tokenFor(u)), "payments.write")).resolves.toBeTruthy();
  });

  it("gives students their student number and keeps staff out of student routes", async () => {
    const s = await makeStudent((await makeProgramme()).id);
    const su = await makeStudentUser(s.id);
    await expect(requireStudent(req(await tokenFor(su)))).resolves.toMatchObject({ studentId: s.id, studentNumber: s.studentNumber });
    const staff = await makeUser("REGISTRY_ADMIN");
    expect(await fail(requireStudent(req(await tokenFor(staff))))).toBeInstanceOf(ForbiddenError);
  });
});
