import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "./db";
import { ForbiddenError, UnauthenticatedError } from "./errors";
import { SESSION_COOKIE, parseSessionCookie } from "@/lib/session-cookie";

/**
 * Simulated authentication (the brief allows a role toggle).
 *
 * The cookie only says "who am I pretending to be". Every API route still
 * enforces authorisation server-side (requireStaff / requireStudent), and a
 * student can only ever read their own records. Replacing this with real auth
 * (NextAuth / SSO) only changes this file.
 */

export type CurrentUser =
  | { role: "STAFF"; actor: string }
  | { role: "STUDENT"; actor: string; studentId: string; studentNumber: string; fullName: string };

export const STAFF_ACTOR = "staff:registry-admin";

async function resolve(cookieValue: string | undefined): Promise<CurrentUser | null> {
  const session = parseSessionCookie(cookieValue);
  if (!session) return null;
  if (session.role === "STAFF") return { role: "STAFF", actor: STAFF_ACTOR };

  const student = await db.student.findUnique({
    where: { id: session.studentId },
    select: { id: true, studentNumber: true, fullName: true },
  });
  // Cookie points at a student that no longer exists → treat as signed out.
  if (!student) return null;
  return {
    role: "STUDENT",
    actor: `student:${student.studentNumber}`,
    studentId: student.id,
    studentNumber: student.studentNumber,
    fullName: student.fullName,
  };
}

/** For Server Components / layouts. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  return resolve(store.get(SESSION_COOKIE)?.value);
}

/** For route handlers — reads the request directly (also makes routes unit-testable). */
export function userFromRequest(req: NextRequest) {
  return resolve(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function requireUser(req: NextRequest): Promise<CurrentUser> {
  const user = await userFromRequest(req);
  if (!user) throw new UnauthenticatedError();
  return user;
}

export async function requireStaff(req: NextRequest) {
  const user = await requireUser(req);
  if (user.role !== "STAFF") throw new ForbiddenError("Only Registry staff can do this");
  return user;
}

export async function requireStudent(req: NextRequest) {
  const user = await requireUser(req);
  if (user.role !== "STUDENT") throw new ForbiddenError("This page is for students — switch role to view it");
  return user;
}
