import "server-only";
import { db } from "../db";
import { audit } from "../audit";
import { NotFoundError, ValidationError } from "../errors";
import { assessmentWindow, evaluateSubmission } from "@/domain/submissions";
import type { CreateAssessmentInput } from "@/lib/validation";

export type SubmissionState = "ON_TIME" | "LATE" | "MISSING";

export async function createAssessment(input: CreateAssessmentInput, actor: string) {
  const mod = await db.module.findUnique({ where: { id: input.moduleId } });
  if (!mod) throw new ValidationError("Module not found", { moduleId: "Choose a valid module" });
  return db.$transaction(async (tx) => {
    const a = await tx.assessment.create({ data: input });
    await audit(tx, {
      actor,
      action: "assessment.created",
      entityType: "Assessment",
      entityId: a.id,
      details: { title: a.title, module: mod.code, deadline: a.deadline.toISOString() },
    });
    return a;
  });
}

export async function updateAssessment(id: string, input: { title?: string; deadline?: Date }, actor: string) {
  const existing = await db.assessment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Assessment");
  return db.$transaction(async (tx) => {
    const a = await tx.assessment.update({ where: { id }, data: input });
    await audit(tx, {
      actor,
      action: "assessment.updated",
      entityType: "Assessment",
      entityId: id,
      details: {
        ...(input.title && { title: { from: existing.title, to: a.title } }),
        ...(input.deadline && { deadline: { from: existing.deadline.toISOString(), to: a.deadline.toISOString() } }),
      },
    });
    return a;
  });
}

function countStates(states: SubmissionState[]) {
  return {
    onTime: states.filter((s) => s === "ON_TIME").length,
    late: states.filter((s) => s === "LATE").length,
    missing: states.filter((s) => s === "MISSING").length,
    total: states.length,
  };
}

/** Cohort = students currently on the module's programme who are ENROLLED, plus anyone who has already submitted. */
export async function listAssessmentsForStaff() {
  const assessments = await db.assessment.findMany({
    orderBy: { deadline: "asc" },
    include: {
      module: { include: { programme: { select: { id: true, code: true, name: true } } } },
      submissions: { select: { studentId: true, isLate: true } },
    },
  });
  const cohorts = await db.student.groupBy({ by: ["programmeId"], where: { status: "ENROLLED" }, _count: true });
  const cohortSize = new Map(cohorts.map((c) => [c.programmeId, c._count]));

  return assessments.map(({ submissions, ...a }) => {
    const onTime = submissions.filter((s) => !s.isLate).length;
    const late = submissions.length - onTime;
    const total = Math.max(cohortSize.get(a.module.programmeId) ?? 0, submissions.length);
    return { ...a, counts: { onTime, late, missing: total - submissions.length, total } };
  });
}

export async function getAssessmentRoster(id: string) {
  const assessment = await db.assessment.findUnique({
    where: { id },
    include: { module: { include: { programme: true } } },
  });
  if (!assessment) throw new NotFoundError("Assessment");

  const students = await db.student.findMany({
    where: {
      programmeId: assessment.module.programmeId,
      OR: [{ status: "ENROLLED" }, { submissions: { some: { assessmentId: id } } }, { grades: { some: { assessmentId: id } } }],
    },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      studentNumber: true,
      fullName: true,
      status: true,
      submissions: { where: { assessmentId: id } },
      grades: { where: { assessmentId: id } },
      resultRelease: { select: { status: true } },
    },
  });

  const rows = students.map(({ submissions, grades, ...s }) => {
    const submission = submissions[0] ?? null;
    const submissionState: SubmissionState = !submission ? "MISSING" : submission.isLate ? "LATE" : "ON_TIME";
    return { ...s, submission, submissionState, grade: grades[0] ?? null };
  });

  return { assessment, rows, counts: countStates(rows.map((r) => r.submissionState)) };
}

export async function listAssessmentsForStudent(studentId: string, now = new Date()) {
  const student = await db.student.findUnique({ where: { id: studentId }, select: { programmeId: true, status: true } });
  if (!student) throw new NotFoundError("Student");

  const assessments = await db.assessment.findMany({
    where: { module: { programmeId: student.programmeId } },
    orderBy: { deadline: "asc" },
    include: {
      module: { select: { code: true, title: true } },
      submissions: { where: { studentId } },
    },
  });

  return assessments.map(({ submissions, ...a }) => {
    const submission = submissions[0] ?? null;
    const decision = evaluateSubmission({ now, deadline: a.deadline, existing: submission, studentStatus: student.status });
    return {
      ...a,
      window: assessmentWindow(a.deadline, now),
      submission,
      canSubmit: decision.allowed,
      blockedReason: decision.allowed ? null : decision.reason,
      willBeLate: decision.allowed && decision.isLate,
    };
  });
}

export function listModules() {
  return db.module.findMany({ orderBy: { code: "asc" }, include: { programme: { select: { code: true, name: true } } } });
}
