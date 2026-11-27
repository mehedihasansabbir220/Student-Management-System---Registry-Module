export type Classification = "FAIL" | "PASS" | "MERIT" | "DISTINCTION";

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  FAIL: "Fail",
  PASS: "Pass",
  MERIT: "Merit",
  DISTINCTION: "Distinction",
};

/** Pass ≥ 40, Merit ≥ 60, Distinction ≥ 70 (inclusive). Below 40 is a Fail. */
export function classify(mark: number): Classification {
  if (!Number.isFinite(mark) || mark < 0 || mark > 100) throw new RangeError(`Mark must be 0–100, got ${mark}`);
  if (mark >= 70) return "DISTINCTION";
  if (mark >= 60) return "MERIT";
  if (mark >= 40) return "PASS";
  return "FAIL";
}

export function averageMark(marks: number[]): number | null {
  if (marks.length === 0) return null;
  const avg = marks.reduce((s, m) => s + m, 0) / marks.length;
  return Math.round(avg * 100) / 100;
}
