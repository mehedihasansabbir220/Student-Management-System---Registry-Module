/**
 * Role-based access control: the single source of truth for who may do what.
 * Used by API route guards, page guards and to build the navigation.
 *
 * Why the split (see docs/adr/002): academics mark work but releasing results
 * is a Registry decision (often after fee or misconduct checks); Finance handles
 * money but never touches grades. Students have no staff permissions at all —
 * their own data is reached only through the student-scoped /api/me routes.
 */

export const ROLES = ["REGISTRY_ADMIN", "FINANCE", "ACADEMIC", "STUDENT"] as const;
export type Role = (typeof ROLES)[number];

export const ALL_PERMISSIONS = [
  "dashboard.read",
  "students.read",
  "students.write",
  "finance.read",
  "fees.write",
  "payments.write",
  "payments.void",
  "reminders.send",
  "assessments.write",
  "submissions.read",
  "grades.write",
  "results.read",
  "results.release",
  "audit.read",
  "users.manage",
] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];

export const PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = Object.freeze({
  REGISTRY_ADMIN: ALL_PERMISSIONS,
  FINANCE: ["dashboard.read", "students.read", "finance.read", "fees.write", "payments.write", "payments.void", "reminders.send"],
  ACADEMIC: ["dashboard.read", "students.read", "assessments.write", "submissions.read", "grades.write", "results.read"],
  STUDENT: [],
});

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}

export function isStaff(role: Role): boolean {
  return role !== "STUDENT";
}

export function homeFor(role: Role): "/staff" | "/me" {
  return isStaff(role) ? "/staff" : "/me";
}

export const ROLE_LABEL: Record<Role, string> = {
  REGISTRY_ADMIN: "Registry Admin",
  FINANCE: "Finance Officer",
  ACADEMIC: "Academic Staff",
  STUDENT: "Student",
};
