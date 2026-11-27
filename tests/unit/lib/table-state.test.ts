import { describe, expect, it } from "vitest";
import { parseTableState, tableStateHref } from "@/lib/table-state";

const opts = { filterKeys: ["status", "programmeId", "q"] as const };

describe("parseTableState", () => {
  it("clamps a hand-edited page and page size and drops unknown keys", () => {
    expect(parseTableState(new URLSearchParams("page=0&pageSize=9999&status=ENROLLED&x=1"), opts)).toEqual({
      page: 1,
      pageSize: 100,
      filters: { status: "ENROLLED" },
    });
  });

  it("falls back to page 1 for a non-number", () => {
    expect(parseTableState(new URLSearchParams("page=abc"), opts).page).toBe(1);
  });

  it("uses the default page size when none is given", () => {
    expect(parseTableState(new URLSearchParams(""), opts).pageSize).toBe(20);
    expect(parseTableState(new URLSearchParams(""), { ...opts, defaultPageSize: 50 }).pageSize).toBe(50);
  });

  it("keeps the sort key and ignores empty filter values", () => {
    expect(parseTableState(new URLSearchParams("sort=-name&status=&q=ada"), opts)).toEqual({ page: 1, pageSize: 20, sort: "-name", filters: { q: "ada" } });
  });
});

describe("tableStateHref", () => {
  const base = { page: 3, pageSize: 20, filters: { status: "ENROLLED" } };

  it("resets to page 1 when a filter changes and omits defaults", () => {
    expect(tableStateHref("/staff/students", base, { filters: { status: "DEFERRED" } })).toBe("/staff/students?status=DEFERRED");
  });

  it("resets to page 1 when the sort changes", () => {
    expect(tableStateHref("/staff/students", base, { sort: "-year" })).toBe("/staff/students?status=ENROLLED&sort=-year");
  });

  it("keeps filters and sort when only the page changes", () => {
    expect(tableStateHref("/staff/students", { ...base, sort: "name" }, { page: 2 })).toBe("/staff/students?status=ENROLLED&sort=name&page=2");
  });

  it("removes a filter patched to undefined", () => {
    expect(tableStateHref("/staff/students", base, { filters: { status: undefined } })).toBe("/staff/students");
  });

  it("keeps a non-default page size", () => {
    expect(tableStateHref("/x", { page: 1, pageSize: 20, filters: {} }, { pageSize: 50 })).toBe("/x?pageSize=50");
  });
});
