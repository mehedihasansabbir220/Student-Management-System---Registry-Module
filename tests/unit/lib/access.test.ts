import { describe, expect, it } from "vitest";
import { pageAccess } from "@/lib/access";
import type { Role } from "@/domain/permissions";

const as = (role: Role) => ({ role });

describe("pageAccess", () => {
  it("sends anonymous visitors on protected pages to login with a return path", () => {
    expect(pageAccess("/staff", null)).toBe("/login?next=%2Fstaff");
    expect(pageAccess("/me/results", null)).toBe("/login?next=%2Fme%2Fresults");
  });

  it("tries a silent refresh first when a refresh session exists", () => {
    expect(pageAccess("/staff/students", null, { canRefresh: true })).toBe("/api/auth/refresh?next=%2Fstaff%2Fstudents");
  });

  it("keeps students out of staff pages and staff out of student pages", () => {
    expect(pageAccess("/staff", as("STUDENT"))).toBe("/me");
    expect(pageAccess("/me", as("FINANCE"))).toBe("/staff");
  });

  it.each<Role>(["REGISTRY_ADMIN", "FINANCE", "ACADEMIC"])("lets %s into the staff area", (role) => {
    expect(pageAccess("/staff/x", as(role))).toBeNull();
  });

  it("lets a student into their own area", () => {
    expect(pageAccess("/me/assessments", as("STUDENT"))).toBeNull();
  });

  it("sends signed-in users from login or root to their home", () => {
    expect(pageAccess("/login", as("ACADEMIC"))).toBe("/staff");
    expect(pageAccess("/", as("STUDENT"))).toBe("/me");
  });

  it("sends anonymous visitors from root to login and leaves public pages alone", () => {
    expect(pageAccess("/", null)).toBe("/login");
    expect(pageAccess("/login", null)).toBeNull();
    expect(pageAccess("/activate", null)).toBeNull();
  });

  it("does not confuse look-alike paths", () => {
    expect(pageAccess("/staffing", null)).toBeNull();
    expect(pageAccess("/media", null)).toBeNull();
  });
});
