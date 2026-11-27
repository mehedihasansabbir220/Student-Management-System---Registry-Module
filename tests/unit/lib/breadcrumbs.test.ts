import { describe, expect, it } from "vitest";
import { breadcrumbsFor } from "@/lib/breadcrumbs";

describe("breadcrumbsFor", () => {
  it("names a dynamic segment from the titles map and leaves the last crumb unlinked", () => {
    expect(breadcrumbsFor("/staff/students/abc", { abc: "Amelia Clarke" })).toEqual([
      { label: "Registry", href: "/staff" },
      { label: "Students", href: "/staff/students" },
      { label: "Amelia Clarke" },
    ]);
  });

  it("uses student-area wording for /me routes", () => {
    expect(breadcrumbsFor("/me/assessments")).toEqual([{ label: "My study", href: "/me" }, { label: "Coursework" }]);
    expect(breadcrumbsFor("/me/results")).toEqual([{ label: "My study", href: "/me" }, { label: "Results" }]);
  });

  it("uses staff wording for staff results", () => {
    expect(breadcrumbsFor("/staff/results").at(-1)).toEqual({ label: "Results release" });
  });

  it("returns a single unlinked crumb for an area root", () => {
    expect(breadcrumbsFor("/staff")).toEqual([{ label: "Registry" }]);
  });

  it("ignores a trailing slash", () => {
    expect(breadcrumbsFor("/staff/students/")).toEqual([{ label: "Registry", href: "/staff" }, { label: "Students" }]);
  });

  it("falls back to 'Details' for an unknown dynamic segment", () => {
    expect(breadcrumbsFor("/staff/assessments/xyz").at(-1)).toEqual({ label: "Details" });
  });
});
