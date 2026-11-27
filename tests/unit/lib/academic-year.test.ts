import { describe, expect, it } from "vitest";
import { currentAcademicYear } from "@/lib/academic-year";

describe("currentAcademicYear", () => {
  it("starts a new year in September", () => expect(currentAcademicYear(new Date("2026-09-01T00:00:00Z"))).toBe("2026/27"));
  it("is still the previous year in August", () => expect(currentAcademicYear(new Date("2026-08-31T23:59:00Z"))).toBe("2025/26"));
  it("pads the short end year across a century", () => expect(currentAcademicYear(new Date("2099-10-01T00:00:00Z"))).toBe("2099/00"));
});
