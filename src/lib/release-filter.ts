export type ReleaseFilter = "graded" | "awaiting";

export function parseReleaseFilter(value: string | undefined): ReleaseFilter {
  return value === "awaiting" ? "awaiting" : "graded";
}

/** Students without grades have nothing to release, so they never appear. */
export function filterReleaseRows<T extends { gradeCount: number; awaitingRelease: boolean }>(rows: T[], filter: ReleaseFilter): T[] {
  return filter === "awaiting" ? rows.filter((r) => r.awaitingRelease) : rows.filter((r) => r.gradeCount > 0);
}
