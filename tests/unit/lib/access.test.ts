import { describe, expect, it } from "vitest";
import { pageAccess } from "@/lib/access";

const staff = { role: "STAFF" } as const;
const student = { role: "STUDENT", studentId: "s1" } as const;

describe("pageAccess", () => {
  it("sends anonymous visitors on protected pages to the role picker", () => {
    expect(pageAccess("/staff", null)).toBe("/");
    expect(pageAccess("/me/results", null)).toBe("/");
  });

  it("keeps students out of staff pages", () => {
    expect(pageAccess("/staff/students", student)).toBe("/me");
  });

  it("keeps staff out of student pages", () => {
    expect(pageAccess("/me", staff)).toBe("/staff");
  });

  it("lets each role into its own area", () => {
    expect(pageAccess("/staff/students/abc", staff)).toBeNull();
    expect(pageAccess("/me/assessments", student)).toBeNull();
  });

  it("sends signed-in users from the picker to their home", () => {
    expect(pageAccess("/", staff)).toBe("/staff");
    expect(pageAccess("/", student)).toBe("/me");
    expect(pageAccess("/", null)).toBeNull();
  });

  it("does not confuse look-alike paths", () => {
    expect(pageAccess("/staffing", null)).toBeNull();
    expect(pageAccess("/media", null)).toBeNull();
  });
});
