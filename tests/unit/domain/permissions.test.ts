import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, PERMISSIONS, can, homeFor, isStaff, type Role } from "@/domain/permissions";

describe("permission matrix", () => {
  it("gives the Registry Admin every permission", () => {
    for (const p of ALL_PERMISSIONS) expect(can("REGISTRY_ADMIN", p)).toBe(true);
  });

  it("limits Finance to money and read access", () => {
    expect([...PERMISSIONS.FINANCE].sort()).toEqual(
      ["dashboard.read", "students.read", "finance.read", "fees.write", "payments.write", "payments.void", "reminders.send"].sort(),
    );
  });

  it("limits Academic staff to coursework and marking", () => {
    expect([...PERMISSIONS.ACADEMIC].sort()).toEqual(
      ["dashboard.read", "students.read", "assessments.write", "submissions.read", "grades.write", "results.read"].sort(),
    );
  });

  it("gives students no staff permissions", () => {
    expect(PERMISSIONS.STUDENT).toEqual([]);
    for (const p of ALL_PERMISSIONS) expect(can("STUDENT", p)).toBe(false);
  });

  it("keeps results release with the Registry, and grades away from Finance", () => {
    expect(can("ACADEMIC", "results.release")).toBe(false);
    expect(can("FINANCE", "grades.write")).toBe(false);
  });
});

describe("role helpers", () => {
  it.each<[Role, string, boolean]>([
    ["REGISTRY_ADMIN", "/staff", true],
    ["FINANCE", "/staff", true],
    ["ACADEMIC", "/staff", true],
    ["STUDENT", "/me", false],
  ])("%s → home %s, staff=%s", (role, home, staff) => {
    expect(homeFor(role)).toBe(home);
    expect(isStaff(role)).toBe(staff);
  });
});
