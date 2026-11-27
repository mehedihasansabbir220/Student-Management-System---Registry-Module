import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { ForbiddenError, UnauthenticatedError } from "./errors";
import { SESSION_COOKIE, parseSessionCookie, type SessionCookie } from "@/lib/session-cookie";

/**
 * Simulated authentication (the brief allows a role toggle).
 *
 * The cookie only says "who am I pretending to be". Every API route still
 * enforces authorisation server-side via requireStaff / requireStudent, so a
 * student session can never call staff endpoints or read another student's data.
 * Swapping this for real auth (NextAuth, SSO) only changes this file.
 */

export type CurrentUser =
  | { role: "STAFF"; actor: string }
  | { role: "STUDENT"; actor: string; studentId: string; studentNumber: string; fullName: string };

export async function getSession(): Promise<SessionCookie | null> {
  const store = await cookies();
  return parseSessionCookie(store.get(SESSION_COOKIE)?.value);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "STAFF") return { role: "STAFF", actor: "staff:registry-admin" };

  const student = await db.student.findUnique({
    where: { id: session.studentId },
    select: { id: true, studentNumber: true, fullName: true },
  });
  // Cookie points at a student that no longer exists → treat as logged out.
  if (!student) return null;
  return {
    role: "STUDENT",
    actor: `student:${student.studentNumber}`,
    studentId: student.id,
    studentNumber: student.studentNumber,
    fullName: student.fullName,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

export async function requireStaff() {
  const user = await requireUser();
  if (user.role !== "STAFF") throw new ForbiddenError("Only Registry staff can do this");
  return user;
}

export async function requireStudent() {
  const user = await requireUser();
  if (user.role !== "STUDENT") throw new ForbiddenError("This action is only available to students");
  return user;
}
