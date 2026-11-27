import { describe, expect, it } from "vitest";
import { filterReleaseRows, parseReleaseFilter } from "@/lib/release-filter";

const rows = [
  { id: "none", gradeCount: 0, awaitingRelease: false },
  { id: "withheld", gradeCount: 2, awaitingRelease: true },
  { id: "published", gradeCount: 3, awaitingRelease: false },
];

describe("filterReleaseRows", () => {
  it("lists every graded student by default, never ungraded ones", () => expect(filterReleaseRows(rows, "graded").map((r) => r.id)).toEqual(["withheld", "published"]));
  it("lists only graded-but-withheld students when awaiting", () => expect(filterReleaseRows(rows, "awaiting").map((r) => r.id)).toEqual(["withheld"]));
});

describe("parseReleaseFilter", () => {
  it("reads awaiting", () => expect(parseReleaseFilter("awaiting")).toBe("awaiting"));
  it("defaults anything else to graded", () => {
    expect(parseReleaseFilter(undefined)).toBe("graded");
    expect(parseReleaseFilter("bogus")).toBe("graded");
  });
});
