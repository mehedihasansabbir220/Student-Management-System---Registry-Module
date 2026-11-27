import { can, isStaff, type Permission, type Role } from "@/domain/permissions";

/**
 * Sidebar model. Kept free of React so it can be unit-tested and shared by the
 * shell; the shell maps `icon` names to lucide components.
 * Visibility is a UX convenience only — every page and API route re-checks.
 */

export type NavIcon = "dashboard" | "students" | "assessments" | "results" | "home" | "coursework" | "fees";
export type NavItem = { href: string; label: string; icon: NavIcon; exact?: boolean };
export type NavGroupLabel = "Overview" | "Students" | "Finance" | "Academic" | "Administration" | "My study";
export type NavGroup = { label: NavGroupLabel; items: NavItem[] };

type StaffItem = NavItem & { permission: Permission };

const STAFF_NAV: { label: NavGroupLabel; items: StaffItem[] }[] = [
  { label: "Overview", items: [{ href: "/staff", label: "Dashboard", icon: "dashboard", permission: "dashboard.read", exact: true }] },
  { label: "Students", items: [{ href: "/staff/students", label: "Students", icon: "students", permission: "students.read" }] },
  // Phase 4/6 add items here (ledger, reminders); empty groups are hidden.
  { label: "Finance", items: [] },
  {
    label: "Academic",
    items: [
      { href: "/staff/assessments", label: "Assessments", icon: "assessments", permission: "submissions.read" },
      { href: "/staff/results", label: "Results release", icon: "results", permission: "results.release" },
    ],
  },
  { label: "Administration", items: [] },
];

const STUDENT_NAV: NavGroup[] = [
  {
    label: "My study",
    items: [
      { href: "/me", label: "Home", icon: "home", exact: true },
      { href: "/me/assessments", label: "Coursework", icon: "coursework" },
      { href: "/me/fees", label: "Fees", icon: "fees" },
      { href: "/me/results", label: "Results", icon: "results" },
    ],
  },
];

export function navFor(role: Role): NavGroup[] {
  if (!isStaff(role)) return STUDENT_NAV;
  return STAFF_NAV.map((g) => ({
    label: g.label,
    items: g.items.filter((i) => can(role, i.permission)).map(({ permission: _p, ...item }) => item),
  })).filter((g) => g.items.length > 0);
}

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
