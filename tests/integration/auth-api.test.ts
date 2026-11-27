import { describe, expect, it } from "vitest";
import * as loginRoute from "@/app/api/auth/login/route";
import * as logoutRoute from "@/app/api/auth/logout/route";
import * as refreshRoute from "@/app/api/auth/refresh/route";
import * as meRoute from "@/app/api/auth/me/route";
import * as activateRoute from "@/app/api/auth/activate/route";
import * as changePasswordRoute from "@/app/api/auth/change-password/route";
import * as sessionsRoute from "@/app/api/auth/sessions/route";
import { db } from "@/server/db";
import { createActivationToken } from "@/server/services/auth";
import { makeProgramme, makeStudent, makeStudentUser, makeUser } from "../support/factories";
import { call } from "../support/http";

let ipSeq = 0;
const freshIp = () => `10.0.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;

const cookieNamed = (setCookie: string[], name: string) => setCookie.find((c) => c.startsWith(`${name}=`));
/** Turn Set-Cookie headers into a Cookie request header (name=value pairs only). */
const asCookieHeader = (setCookie: string[]) => setCookie.map((c) => c.split(";")[0]).join("; ");

async function signIn(role: "FINANCE" | "REGISTRY_ADMIN" = "FINANCE", overrides = {}) {
  const u = await makeUser(role, overrides);
  const res = await call(loginRoute.POST, { method: "POST", as: "none", json: { email: u.email, password: u.password }, headers: { "x-forwarded-for": freshIp() } });
  return { u, res, cookie: asCookieHeader(res.setCookie) };
}

describe("POST /api/auth/login", () => {
  it("sets httpOnly access and refresh cookies and tells the client where to go", async () => {
    const { u, res } = await signIn("FINANCE");
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ user: { id: u.id, role: "FINANCE" }, home: "/staff" });
    const at = cookieNamed(res.setCookie, "sms_at")!;
    const rt = cookieNamed(res.setCookie, "sms_rt")!;
    expect(at).toMatch(/HttpOnly/i);
    expect(at).toMatch(/SameSite=lax/i);
    expect(at).toMatch(/Path=\/(;|$)/);
    expect(rt).toMatch(/HttpOnly/i);
    expect(rt).toMatch(/SameSite=strict/i);
    expect(rt).toMatch(/Path=\/api\/auth/);
  });

  it("sends students to their portal", async () => {
    const s = await makeStudent((await makeProgramme()).id);
    const su = await makeStudentUser(s.id);
    const res = await call(loginRoute.POST, { method: "POST", as: "none", json: { email: su.email, password: su.password }, headers: { "x-forwarded-for": freshIp() } });
    expect(res.data.home).toBe("/me");
  });

  it("returns a generic 401 and no cookies for a wrong password", async () => {
    const u = await makeUser("FINANCE");
    const res = await call(loginRoute.POST, { method: "POST", as: "none", json: { email: u.email, password: "wrong-password" }, headers: { "x-forwarded-for": freshIp() } });
    expect(res.status).toBe(401);
    expect(res.data.error.message).toBe("Email or password is incorrect");
    expect(res.setCookie).toHaveLength(0);
  });

  it("rate-limits a single IP after 20 attempts in 15 minutes", async () => {
    const ip = freshIp();
    const attempt = () => call(loginRoute.POST, { method: "POST", as: "none", json: { email: "nobody@x.com", password: "x" }, headers: { "x-forwarded-for": ip } });
    for (let i = 0; i < 20; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.data.error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("returns 400 for a malformed body", async () => {
    const res = await call(loginRoute.POST, { method: "POST", as: "none", json: { email: "not-an-email" }, headers: { "x-forwarded-for": freshIp() } });
    expect(res.status).toBe(400);
  });
});

describe("/api/auth/refresh", () => {
  it("POST rotates the cookies", async () => {
    const { cookie } = await signIn();
    const res = await call(refreshRoute.POST, { method: "POST", as: { cookie } });
    expect(res.status).toBe(200);
    expect(cookieNamed(res.setCookie, "sms_rt")).not.toBe(cookie.split("; ").find((c) => c.startsWith("sms_rt=")));
  });

  it("POST without a refresh cookie is 401 and clears cookies", async () => {
    const res = await call(refreshRoute.POST, { method: "POST", as: "none" });
    expect(res.status).toBe(401);
    expect(cookieNamed(res.setCookie, "sms_at")).toMatch(/Max-Age=0/);
  });

  it("GET (page navigation) redirects back to the page on success", async () => {
    const { cookie } = await signIn();
    const res = await call(refreshRoute.GET, { as: { cookie }, url: "http://localhost/api/auth/refresh?next=%2Fstaff%2Fstudents" });
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/staff/students");
    expect(cookieNamed(res.setCookie, "sms_at")).toBeTruthy();
  });

  it("GET on failure goes to login with the return path — never back to the page (no redirect loop)", async () => {
    const res = await call(refreshRoute.GET, { as: "none", url: "http://localhost/api/auth/refresh?next=%2Fstaff" });
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname + loc.search).toBe("/login?next=%2Fstaff");
    expect(cookieNamed(res.setCookie, "sms_at")).toMatch(/Max-Age=0/);
    expect(cookieNamed(res.setCookie, "sms_rt")).toMatch(/Max-Age=0/);
  });

  it("GET never redirects off-site, even when asked to", async () => {
    const { cookie } = await signIn();
    const res = await call(refreshRoute.GET, { as: { cookie }, url: "http://localhost/api/auth/refresh?next=%2F%2Fevil.com" });
    const loc = new URL(res.headers.get("location")!);
    expect(loc.host).toBe("localhost");
    expect(loc.pathname).toBe("/");
  });
});

describe("logout, me, sessions, password", () => {
  it("login sets a readable session-hint cookie (no secret in it) and logout clears it", async () => {
    const { res, cookie } = await signIn();
    const hint = cookieNamed(res.setCookie, "sms_has_rt")!;
    expect(hint).toMatch(/^sms_has_rt=1;/);
    expect(hint).not.toMatch(/HttpOnly/i);
    expect(hint).toMatch(/Path=\/(;|$)/);
    const out = await call(logoutRoute.POST, { method: "POST", as: { cookie } });
    expect(cookieNamed(out.setCookie, "sms_has_rt")).toMatch(/Max-Age=0/);
  });

  it("logout clears cookies and kills the refresh token", async () => {
    const { cookie } = await signIn();
    const res = await call(logoutRoute.POST, { method: "POST", as: { cookie } });
    expect(res.status).toBe(200);
    expect(cookieNamed(res.setCookie, "sms_rt")).toMatch(/Max-Age=0/);
    expect((await call(refreshRoute.POST, { method: "POST", as: { cookie } })).status).toBe(401);
  });

  it("me returns the signed-in user, 401 without a session", async () => {
    const { u, cookie } = await signIn("REGISTRY_ADMIN");
    expect((await call(meRoute.GET, { as: { cookie } })).data.user).toMatchObject({ id: u.id, email: u.email, role: "REGISTRY_ADMIN" });
    expect((await call(meRoute.GET, { as: "none" })).status).toBe(401);
  });

  it("sessions: list, then sign out the others", async () => {
    const { u, cookie } = await signIn();
    await call(loginRoute.POST, { method: "POST", as: "none", json: { email: u.email, password: u.password }, headers: { "x-forwarded-for": freshIp() } });
    const list = await call(sessionsRoute.GET, { as: { cookie } });
    expect(list.data.items).toHaveLength(2);
    const del = await call(sessionsRoute.DELETE, { method: "DELETE", as: { cookie } });
    expect(del.data.revoked).toBe(1);
  });

  it("change-password is refused for shared demo accounts", async () => {
    const { u, cookie } = await signIn("REGISTRY_ADMIN", { isDemo: true });
    const res = await call(changePasswordRoute.POST, { method: "POST", as: { cookie }, json: { currentPassword: u.password, newPassword: "Brand-New-Pass-1" } });
    expect(res.status).toBe(422);
  });

  it("activate signs the new user in", async () => {
    const u = await makeUser("ACADEMIC", { password: null });
    const token = await db.$transaction((tx) => createActivationToken(tx, u.id));
    const res = await call(activateRoute.POST, { method: "POST", as: "none", json: { token, password: "Fresh-Password-1" } });
    expect(res.status).toBe(200);
    expect(res.data.home).toBe("/staff");
    expect(cookieNamed(res.setCookie, "sms_at")).toBeTruthy();
  });
});
