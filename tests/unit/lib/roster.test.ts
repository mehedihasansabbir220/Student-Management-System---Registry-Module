import { describe, expect, it } from "vitest";
import { filterRoster, parseRosterState } from "@/lib/roster";

const rows = [
  { id: "a", submissionState: "ON_TIME" as const },
  { id: "b", submissionState: "LATE" as const },
  { id: "c", submissionState: "MISSING" as const },
  { id: "d", submissionState: "LATE" as const },
];

describe("filterRoster", () => {
  it("returns every row without a filter", () => expect(filterRoster(rows, undefined)).toHaveLength(4));
  it("keeps only late rows", () => expect(filterRoster(rows, "LATE").map((r) => r.id)).toEqual(["b", "d"]));
  it("keeps only missing rows", () => expect(filterRoster(rows, "MISSING").map((r) => r.id)).toEqual(["c"]));
  it("handles an empty roster", () => expect(filterRoster([], "LATE")).toEqual([]));
});

describe("parseRosterState", () => {
  it("accepts the three states case-insensitively", () => {
    expect(parseRosterState("late")).toBe("LATE");
    expect(parseRosterState("ON_TIME")).toBe("ON_TIME");
  });
  it("ignores anything else", () => {
    expect(parseRosterState("bogus")).toBeUndefined();
    expect(parseRosterState(undefined)).toBeUndefined();
  });
});
