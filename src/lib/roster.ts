export type RosterState = "ON_TIME" | "LATE" | "MISSING";
const STATES: readonly RosterState[] = ["ON_TIME", "LATE", "MISSING"];

/** `?state=` from the URL; anything unrecognised means "no filter". */
export function parseRosterState(value: string | undefined): RosterState | undefined {
  const v = value?.toUpperCase();
  return STATES.find((s) => s === v);
}

export function filterRoster<T extends { submissionState: RosterState }>(rows: T[], state: RosterState | undefined): T[] {
  return state ? rows.filter((r) => r.submissionState === state) : rows;
}
