import { describe, expect, it } from "vitest";
import { averageMark, classify } from "@/domain/grades";

describe("classify", () => {
  it.each([
    [0, "FAIL"],
    [39.99, "FAIL"],
    [40, "PASS"],
    [59.99, "PASS"],
    [60, "MERIT"],
    [69.99, "MERIT"],
    [70, "DISTINCTION"],
    [100, "DISTINCTION"],
  ] as const)("%s → %s (boundaries are inclusive)", (mark, expected) => {
    expect(classify(mark)).toBe(expected);
  });

  it("rejects marks outside 0–100", () => {
    expect(() => classify(-1)).toThrow();
    expect(() => classify(100.01)).toThrow();
    expect(() => classify(Number.NaN)).toThrow();
  });
});

describe("averageMark", () => {
  it("averages to two decimal places", () => {
    expect(averageMark([70, 65, 40])).toBe(58.33);
  });

  it("returns null when there are no marks", () => {
    expect(averageMark([])).toBeNull();
  });
});
