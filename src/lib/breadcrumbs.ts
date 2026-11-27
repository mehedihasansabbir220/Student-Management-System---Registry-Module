export type Crumb = { label: string; href?: string };

const AREA: Record<string, string> = { staff: "Registry", me: "My study" };

const LABELS: Record<"staff" | "me", Record<string, string>> = {
  staff: { students: "Students", assessments: "Assessments", results: "Results release", account: "Account", new: "New" },
  me: { assessments: "Coursework", results: "Results", fees: "Fees", account: "Account" },
};

/**
 * Breadcrumbs from a pathname. `titles` names dynamic segments (e.g. a student
 * id → their name) so server pages can label their own crumb.
 */
export function breadcrumbsFor(pathname: string, titles: Record<string, string> = {}): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const area = segments[0];
  if (area !== "staff" && area !== "me") return [];

  const crumbs: Crumb[] = segments.map((seg, i) => {
    const label = i === 0 ? AREA[area] : (LABELS[area][seg] ?? titles[seg] ?? "Details");
    return { label, href: `/${segments.slice(0, i + 1).join("/")}` };
  });
  const last = crumbs[crumbs.length - 1];
  crumbs[crumbs.length - 1] = { label: last.label };
  return crumbs;
}
