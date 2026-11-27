import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  createAssessment,
  getAssessmentRoster,
  listAssessmentsForStaff,
  listAssessmentsForStudent,
  updateAssessment,
} from "@/server/services/assessments";
import { submitAssessment } from "@/server/services/submissions";
import { ValidationError } from "@/server/errors";
import { STAFF, makeAssessment, makeModule, makeProgramme, makeStudent } from "../support/factories";

const deadline = new Date("2026-03-15T17:00:00Z");
const pdf = new TextEncoder().encode("%PDF-1.7 test");
const submit = (assessmentId: string, studentId: string, now: Date) =>
  submitAssessment({ assessmentId, studentId, fileName: "a.pdf", bytes: pdf, now, actor: "student:test" });

describe("createAssessment", () => {
  it("creates an assessment for a module and audits it", async () => {
    const m = await makeModule((await makeProgramme()).id);
    const a = await createAssessment({ title: "Essay", moduleId: m.id, deadline }, STAFF);
    expect(a).toMatchObject({ title: "Essay", moduleId: m.id });
    expect(await db.auditLog.count({ where: { action: "assessment.created", entityId: a.id } })).toBe(1);
  });

  it("rejects an unknown module as a field error", async () => {
    const err = await createAssessment({ title: "Essay", moduleId: "nope", deadline }, STAFF).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.fields).toHaveProperty("moduleId");
  });
});

describe("listAssessmentsForStudent", () => {
  it("shows only the student's programme assessments with their own submission state", async () => {
    const p = await makeProgramme();
    const m = await makeModule(p.id);
    const mine = await makeAssessment(m.id, deadline, "Mine");
    await makeAssessment((await makeModule((await makeProgramme()).id)).id, deadline, "Other programme");
    const s = await makeStudent(p.id);
    await submit(mine.id, s.id, new Date("2026-03-16T00:00:00Z"));

    const list = await listAssessmentsForStudent(s.id, new Date("2026-03-16T00:00:00Z"));
    expect(list.map((a) => a.title)).toEqual(["Mine"]);
    expect(list[0]).toMatchObject({ window: "CLOSED", submission: { isLate: true }, canSubmit: false });
  });

  it("marks an open, unsubmitted assessment as submittable", async () => {
    const p = await makeProgramme();
    await makeAssessment((await makeModule(p.id)).id, deadline);
    const s = await makeStudent(p.id);
    const [a] = await listAssessmentsForStudent(s.id, new Date("2026-03-01T00:00:00Z"));
    expect(a).toMatchObject({ window: "OPEN", submission: null, canSubmit: true });
  });
});

describe("getAssessmentRoster", () => {
  it("lists every student on the programme as on time, late or missing", async () => {
    const p = await makeProgramme();
    const a = await makeAssessment((await makeModule(p.id)).id, deadline);
    const onTime = await makeStudent(p.id, { fullName: "A On Time" });
    const late = await makeStudent(p.id, { fullName: "B Late" });
    await makeStudent(p.id, { fullName: "C Missing" });
    await submit(a.id, onTime.id, new Date("2026-03-10T00:00:00Z"));
    await submit(a.id, late.id, new Date("2026-03-16T00:00:00Z"));

    const roster = await getAssessmentRoster(a.id);
    expect(roster.rows.map((r) => [r.fullName, r.submissionState])).toEqual([
      ["A On Time", "ON_TIME"],
      ["B Late", "LATE"],
      ["C Missing", "MISSING"],
    ]);
    expect(roster.counts).toEqual({ onTime: 1, late: 1, missing: 1, total: 3 });
  });
});

describe("listAssessmentsForStaff", () => {
  it("includes submission counts per assessment", async () => {
    const p = await makeProgramme();
    const a = await makeAssessment((await makeModule(p.id)).id, deadline);
    const s = await makeStudent(p.id);
    await makeStudent(p.id);
    await submit(a.id, s.id, new Date("2026-03-16T00:00:00Z"));
    const [row] = await listAssessmentsForStaff();
    expect(row.counts).toEqual({ onTime: 0, late: 1, missing: 1, total: 2 });
  });
});

describe("updateAssessment", () => {
  it("extending the deadline does not un-flag existing late submissions", async () => {
    const p = await makeProgramme();
    const a = await makeAssessment((await makeModule(p.id)).id, deadline);
    const s = await makeStudent(p.id);
    await submit(a.id, s.id, new Date("2026-03-16T00:00:00Z"));
    await updateAssessment(a.id, { deadline: new Date("2026-03-20T17:00:00Z") }, STAFF);
    const sub = await db.submission.findFirstOrThrow({ where: { assessmentId: a.id } });
    expect(sub.isLate).toBe(true);
  });
});
