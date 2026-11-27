import { describe, expect, it } from "vitest";
import { ROLES } from "@/domain/permissions";
import { isActive, navFor } from "@/lib/nav";

const hrefs = (role: Parameters<typeof navFor>[0]) => navFor(role).flatMap((g) => g.items.map((i) => i.href));

describe("navFor", () => {
  it("gives a registry admin every staff area, grouped in sidebar order", () => {
    const groups = navFor("REGISTRY_ADMIN");
    expect(groups.map((g) => g.label)).toEqual(["Overview", "Students", "Academic"]);
    expect(hrefs("REGISTRY_ADMIN")).toEqual(["/staff", "/staff/students", "/staff/assessments", "/staff/results"]);
  });

  it("hides academic areas from finance", () => {
    expect(hrefs("FINANCE")).toEqual(["/staff", "/staff/students"]);
  });

  it("hides results release from academic staff", () => {
    expect(hrefs("ACADEMIC")).toEqual(["/staff", "/staff/students", "/staff/assessments"]);
  });

  it("gives students their own study area only", () => {
    const groups = navFor("STUDENT");
    expect(groups.map((g) => g.label)).toEqual(["My study"]);
    expect(hrefs("STUDENT")).toEqual(["/me", "/me/assessments", "/me/fees", "/me/results"]);
  });

  it("never returns an empty group", () => {
    for (const role of ROLES) {
      for (const g of navFor(role)) expect(g.items.length).toBeGreaterThan(0);
    }
  });
});

describe("isActive", () => {
  it("matches exact items only on their own path", () => {
    expect(isActive("/staff", { href: "/staff", exact: true })).toBe(true);
    expect(isActive("/staff/students", { href: "/staff", exact: true })).toBe(false);
  });

  it("matches nested paths for non-exact items", () => {
    expect(isActive("/staff/students/abc", { href: "/staff/students" })).toBe(true);
  });

  it("does not match a sibling path sharing a prefix", () => {
    expect(isActive("/staff/studentsx", { href: "/staff/students" })).toBe(false);
  });
});
