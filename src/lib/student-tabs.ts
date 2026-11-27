import { can, isStaff, type Permission, type Role } from "@/domain/permissions";

export const STUDENT_TABS = ["overview", "finance", "coursework", "results", "activity"] as const;
export type StudentTab = (typeof STUDENT_TABS)[number];

/** Which permission (if any) a tab needs. The page also only *loads* a tab's data for roles that pass. */
const NEEDS: Record<StudentTab, Permission | null> = {
  overview: null,
  finance: "finance.read",
  coursework: "submissions.read",
  results: "results.read",
  activity: null,
};

export function studentTabsFor(role: Role): StudentTab[] {
  if (!isStaff(role)) return [];
  return STUDENT_TABS.filter((t) => NEEDS[t] === null || can(role, NEEDS[t]));
}

/** The tab to show for `?tab=`: unknown or forbidden values fall back to the overview. */
export function resolveTab(requested: string | undefined, role: Role): StudentTab {
  return studentTabsFor(role).find((t) => t === requested) ?? "overview";
}
