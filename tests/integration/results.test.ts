import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  enterGrade,
  getStaffMarksheet,
  getStudentResults,
  listReleaseOverview,
  publishResults,
  withholdResults,
} from "@/server/services/results";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "@/server/errors";
import { STAFF, makeAssessment, makeModule, makeProgramme, makeStudent } from "../support/factories";

const deadline = new Date("2026-03-15T17:00:00Z");

async function setup() {
  const p = await makeProgramme();
  const m = await makeModule(p.id, { code: "CS101", title: "Programming" });
  const a1 = await makeAssessment(m.id, deadline, "Essay");
  const a2 = await makeAssessment(m.id, deadline, "Exam");
  const s = await makeStudent(p.id);
  return { p, m, a1, a2, s };
}

describe("enterGrade", () => {
  it("stores the mark and returns its classification", async () => {
    const { a1, s } = await setup();
    const g = await enterGrade({ assessmentId: a1.id, studentId: s.id, mark: 65 }, STAFF);
    expect(g).toMatchObject({ mark: 65, classification: "MERIT", hasSubmission: false });
  });

  it("updates an existing grade and audits the change with from/to", async () => {
    const { a1, s } = await setup();
    await enterGrade({ assessmentId: a1.id, studentId: s.id, mark: 55 }, STAFF);
    await enterGrade({ assessmentId: a1.id, studentId: s.id, mark: 72.5 }, STAFF);
    expect(await db.grade.count()).toBe(1);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "grade.changed" } });
    expect(log.details).toMatchObject({ from: 55, to: 72.5 });
  });

  it("does not write an audit entry when the mark is unchanged", async () => {
    const { a1, s } = await setup();
    await enterGrade({ assessmentId: a1.id, studentId: s.id, mark: 55 }, STAFF);
    await enterGrade({ assessmentId: a1.id, studentId: s.id, mark: 55 }, STAFF);
    expect(await db.auditLog.count({ where: { action: { startsWith: "grade." } } })).toBe(1);
  });

  it("refuses to grade a student who is not on the assessment's programme", async () => {
    const { a1 } = await setup();
    const outsider = await makeStudent((await makeProgramme()).id);
    await expect(enterGrade({ assessmentId: a1.id, studentId: outsider.id, mark: 50 }, STAFF)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws NotFoundError for an unknown assessment", async () => {
    const { s } = await setup();
    await expect(enterGrade({ assessmentId: "nope", studentId: s.id, mark: 50 }, STAFF)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("results release", () => {
  it("hides all marks from the student while results are withheld", async () => {
    const { a1, s } = await setup();
    await enterGrade({ assessmentId: a1.id, studentId: s.id, mark: 80 }, STAFF);
    const r = await getStudentResults(s.id);
    expect(r).toEqual({ status: "WITHHELD", reason: null });
    expect(JSON.stringify(r)).not.toContain("80");
  });

  it("refuses to publish when there are no grades", async () => {
    const { s } = await setup();
    await expect(publishResults(s.id, STAFF)).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("shows the marksheet with classifications and average once published", async () => {
    const { a1, a2, s } = await setup();
    await enterGrade({ assessmentId: a1.id, studentId: s.id, mark: 70 }, STAFF);
    await enterGrade({ assessmentId: a2.id, studentId: s.id, mark: 39 }, STAFF);
    await publishResults(s.id, STAFF);

    const r = await getStudentResults(s.id);
    expect(r.status).toBe("PUBLISHED");
    if (r.status !== "PUBLISHED") return;
    expect(r.grades.map((g) => [g.assessmentTitle, g.mark, g.classification])).toEqual([
      ["Essay", 70, "DISTINCTION"],
      ["Exam", 39, "FAIL"],
    ]);
    expect(r.average).toBe(54.5);
    expect(r.publishedAt).toBeInstanceOf(Date);
  });

  it("withholding after publication immediately hides results again", async () => {
    const { a1, s } = await setup();
    await enterGrade({ assessmentId: a1.id, studentId: s.id, mark: 70 }, STAFF);
    await publishResults(s.id, STAFF);
    await withholdResults(s.id, { reason: "Outstanding fees", shareReason: false }, STAFF);
    expect(await getStudentResults(s.id)).toEqual({ status: "WITHHELD", reason: null });
  });

  it("shares the withhold reason only when staff choose to", async () => {
    const { s } = await setup();
    await withholdResults(s.id, { reason: "Outstanding fees", shareReason: true }, STAFF);
    expect(await getStudentResults(s.id)).toEqual({ status: "WITHHELD", reason: "Outstanding fees" });
  });

  it("audits publish and withhold decisions", async () => {
    const { a1, s } = await setup();
    await enterGrade({ assessmentId: a1.id, studentId: s.id, mark: 70 }, STAFF);
    await publishResults(s.id, STAFF);
    await withholdResults(s.id, { reason: "Misconduct review", shareReason: false }, STAFF);
    const actions = (await db.auditLog.findMany({ where: { studentId: s.id }, orderBy: { createdAt: "asc" } })).map((l) => l.action);
    expect(actions).toEqual(["grade.entered", "results.published", "results.withheld"]);
  });
});

describe("staff views", () => {
  it("staff marksheet shows every grade regardless of release status", async () => {
    const { a1, s } = await setup();
    await enterGrade({ assessmentId: a1.id, studentId: s.id, mark: 45 }, STAFF);
    const m = await getStaffMarksheet(s.id);
    expect(m.release.status).toBe("WITHHELD");
    expect(m.grades.map((g) => g.mark)).toEqual([45]);
  });

  it("release overview flags students with grades awaiting release", async () => {
    const { a1, s } = await setup();
    await enterGrade({ assessmentId: a1.id, studentId: s.id, mark: 45 }, STAFF);
    const overview = await listReleaseOverview();
    expect(overview.find((r) => r.id === s.id)).toMatchObject({ gradeCount: 1, releaseStatus: "WITHHELD", awaitingRelease: true });
  });
});
