import { describe, expect, it } from "vitest";
import { formatStudentNumber, intakeYear, isValidAcademicYear } from "@/domain/student-number";

describe("formatStudentNumber", () => {
  it("pads the sequence to four digits", () => {
    expect(formatStudentNumber(2025, 1)).toBe("SMS-2025-0001");
    expect(formatStudentNumber(2025, 123)).toBe("SMS-2025-0123");
    expect(formatStudentNumber(2025, 9999)).toBe("SMS-2025-9999");
  });

  it("keeps growing past 9999 rather than wrapping or colliding", () => {
    expect(formatStudentNumber(2025, 10000)).toBe("SMS-2025-10000");
  });

  it("rejects non-positive or fractional sequences", () => {
    expect(() => formatStudentNumber(2025, 0)).toThrow();
    expect(() => formatStudentNumber(2025, 1.5)).toThrow();
  });
});

describe("isValidAcademicYear", () => {
  it("accepts consecutive years in YYYY/YY form", () => {
    expect(isValidAcademicYear("2025/26")).toBe(true);
    expect(isValidAcademicYear("2099/00")).toBe(true);
  });

  it("rejects non-consecutive years and bad formats", () => {
    expect(isValidAcademicYear("2025/27")).toBe(false);
    expect(isValidAcademicYear("2025-26")).toBe(false);
    expect(isValidAcademicYear("25/26")).toBe(false);
    expect(isValidAcademicYear("")).toBe(false);
  });
});

describe("intakeYear", () => {
  it("is the first calendar year of the academic year", () => {
    expect(intakeYear("2025/26")).toBe(2025);
  });
});
