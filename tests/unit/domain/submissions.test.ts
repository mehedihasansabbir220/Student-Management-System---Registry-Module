import { describe, expect, it } from "vitest";
import { assessmentWindow, evaluateSubmission } from "@/domain/submissions";

const deadline = new Date("2026-03-15T17:00:00Z");
const before = new Date("2026-03-15T16:59:59Z");
const after = new Date("2026-03-15T17:00:01Z");

describe("evaluateSubmission", () => {
  it("accepts a first submission before the deadline as on time", () => {
    expect(evaluateSubmission({ now: before, deadline, existing: null, studentStatus: "ENROLLED" })).toEqual({
      allowed: true,
      isLate: false,
      isResubmission: false,
    });
  });

  it("treats a submission exactly at the deadline as on time", () => {
    const r = evaluateSubmission({ now: deadline, deadline, existing: null, studentStatus: "ENROLLED" });
    expect(r).toMatchObject({ allowed: true, isLate: false });
  });

  it("allows resubmission before the deadline", () => {
    const r = evaluateSubmission({ now: before, deadline, existing: { isLate: false }, studentStatus: "ENROLLED" });
    expect(r).toEqual({ allowed: true, isLate: false, isResubmission: true });
  });

  it("accepts a first submission after the deadline but flags it late", () => {
    const r = evaluateSubmission({ now: after, deadline, existing: null, studentStatus: "ENROLLED" });
    expect(r).toEqual({ allowed: true, isLate: true, isResubmission: false });
  });

  it("refuses to overwrite on-time work after the deadline", () => {
    const r = evaluateSubmission({ now: after, deadline, existing: { isLate: false }, studentStatus: "ENROLLED" });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toMatch(/deadline has passed/i);
  });

  it("refuses a second late attempt", () => {
    const r = evaluateSubmission({ now: after, deadline, existing: { isLate: true }, studentStatus: "ENROLLED" });
    expect(r.allowed).toBe(false);
  });

  it.each(["WITHDRAWN", "DEFERRED", "COMPLETED"] as const)("refuses submissions from %s students", (status) => {
    const r = evaluateSubmission({ now: before, deadline, existing: null, studentStatus: status });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toMatch(status.toLowerCase());
  });
});

describe("assessmentWindow", () => {
  it("is OPEN more than 48 hours before the deadline", () => {
    expect(assessmentWindow(deadline, new Date("2026-03-13T16:59:00Z"))).toBe("OPEN");
  });

  it("is CLOSING_SOON within 48 hours of the deadline", () => {
    expect(assessmentWindow(deadline, new Date("2026-03-14T17:00:00Z"))).toBe("CLOSING_SOON");
  });

  it("is CLOSED after the deadline (late submissions still possible)", () => {
    expect(assessmentWindow(deadline, after)).toBe("CLOSED");
  });
});
