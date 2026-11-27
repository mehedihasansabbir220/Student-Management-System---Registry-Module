import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { db } from "./db";
import { ForbiddenError, TokenExpiredError, UnauthenticatedError } from "./errors";
import { ACCESS_COOKIE } from "./auth/cookies";
import { TokenError, verifyAccessToken } from "@/lib/auth/jwt";
import { can, homeFor, isStaff, type Permission, type Role } from "@/domain/permissions";

/**
 * Who is making this request. The access JWT proves identity cheaply; we still
 * re-read the user from the DB on every request so that deactivating an account
 * takes effect immediately, not when the 15-minute token expires.
 */
export type CurrentUser = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  /** Audit-log identity, e.g. "user:farid@demo.sms" */
  actor: string;
  /** Refresh-token family id of this login session */
  sessionId: string;
  isDemo: boolean;
  studentId: string | null;
  studentNumber: string | null;
};

type Resolution = { user: CurrentUser } | { expired: true } | null;

async function resolve(token: string | undefined): Promise<Resolution> {
  if (!token) return null;
  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch (err) {
    if (err instanceof TokenError && err.reason === "expired") return { expired: true };
    return null;
  }
  const user = await db.user.findUnique({ where: { id: claims.sub }, include: { student: { select: { studentNumber: true } } } });
  if (!user || !user.isActive) return null;
  return {
    user: {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      actor: `user:${user.email}`,
      sessionId: claims.sid,
      isDemo: user.isDemo,
      studentId: user.studentId,
      studentNumber: user.student?.studentNumber ?? null,
    },
  };
}

/** For route handlers. Throws TokenExpiredError (→ 401 TOKEN_EXPIRED) so the client knows to refresh. */
export async function userFromRequest(req: NextRequest): Promise<CurrentUser | null> {
  const r = await resolve(req.cookies.get(ACCESS_COOKIE)?.value);
  if (r && "expired" in r) throw new TokenExpiredError();
  return r?.user ?? null;
}

export async function requireUser(req: NextRequest): Promise<CurrentUser> {
  const user = await userFromRequest(req);
  if (!user) throw new UnauthenticatedError();
  return user;
}

export async function requirePermission(req: NextRequest, permission: Permission): Promise<CurrentUser> {
  const user = await requireUser(req);
  if (!can(user.role, permission)) throw new ForbiddenError("You don't have permission to do this");
  return user;
}

export async function requireStudent(req: NextRequest): Promise<CurrentUser & { studentId: string; studentNumber: string }> {
  const user = await requireUser(req);
  if (user.role !== "STUDENT" || !user.studentId || !user.studentNumber) {
    throw new ForbiddenError("This is only available to students");
  }
  return user as CurrentUser & { studentId: string; studentNumber: string };
}

/** TEMPORARY (plan Task 9 removes it): any staff role. Keeps v1 routes compiling during the migration. */
export async function requireStaff(req: NextRequest): Promise<CurrentUser> {
  const user = await requireUser(req);
  if (!isStaff(user.role)) throw new ForbiddenError("Only staff can do this");
  return user;
}

/** For Server Components / layouts. Expired or invalid → null (middleware handles the refresh). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const r = await resolve(store.get(ACCESS_COOKIE)?.value);
  return r && "user" in r ? r.user : null;
}

/** Page guard: signed in and holding `permission`, else redirect. */
export async function requirePagePermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, permission)) redirect(homeFor(user.role));
  return user;
}
