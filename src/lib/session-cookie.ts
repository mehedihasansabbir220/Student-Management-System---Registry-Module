// Shared by server code and middleware (edge runtime) — keep dependency-free.

export const SESSION_COOKIE = "sms_session";

export type SessionCookie = { role: "STAFF" } | { role: "STUDENT"; studentId: string };

export function parseSessionCookie(value: string | undefined): SessionCookie | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<{ role: string; studentId: string }>;
    if (parsed.role === "STAFF") return { role: "STAFF" };
    if (parsed.role === "STUDENT" && typeof parsed.studentId === "string" && parsed.studentId) {
      return { role: "STUDENT", studentId: parsed.studentId };
    }
  } catch {
    // Tampered or legacy cookie → ignore
  }
  return null;
}
