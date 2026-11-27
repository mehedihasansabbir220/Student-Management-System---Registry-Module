import { can, isStaff, type Permission, type Role } from "@/domain/permissions";

/**
 * What each role sees on the dashboard. One fixed order (most urgent first),
 * filtered by permission, so the dashboard can never drift from the matrix:
 * Finance gets money work, Academic gets coursework, the Registry gets both.
 */

export type DashboardSection = "overdue" | "awaitingRelease" | "deadlines" | "late";
export type DashboardKpi = "enrolled" | "overdue" | "awaitingRelease" | "outstanding" | "deadlines";

const SECTIONS: [DashboardSection, Permission][] = [
  ["overdue", "finance.read"],
  ["awaitingRelease", "results.release"],
  ["deadlines", "submissions.read"],
  ["late", "submissions.read"],
];

const KPIS: [DashboardKpi, Permission][] = [
  ["enrolled", "dashboard.read"],
  ["overdue", "finance.read"],
  ["awaitingRelease", "results.release"],
  ["outstanding", "finance.read"],
  ["deadlines", "submissions.read"],
];

export function dashboardSectionsFor(role: Role): DashboardSection[] {
  return isStaff(role) ? SECTIONS.filter(([, p]) => can(role, p)).map(([s]) => s) : [];
}

export function dashboardKpisFor(role: Role): DashboardKpi[] {
  return isStaff(role) ? KPIS.filter(([, p]) => can(role, p)).map(([k]) => k) : [];
}
