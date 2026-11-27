import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { audit } from "../audit";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "../errors";
import { logger } from "../logger";
import { averageMark, classify, type Classification } from "@/domain/grades";
import type { GradeInput, WithholdResultsInput } from "@/lib/validation";

const toMark = (d: Prisma.Decimal) => Number(d.toString());

export async function enterGrade(input: GradeInput, actor: string) {
  const [assessment, student] = await Promise.all([
    db.assessment.findUnique({ where: { id: input.assessmentId }, include: { module: { select: { programmeId: true } } } }),
    db.student.findUnique({ where: { id: input.studentId }, include: { resultRelease: true } }),
  ]);
  if (!assessment) throw new NotFoundError("Assessment");
  if (!student) throw new NotFoundError("Student");
  if (assessment.module.programmeId !== student.programmeId) {
    throw new ForbiddenError("This student is not on the programme this assessment belongs to");
  }

  const key = { assessmentId_studentId: { assessmentId: assessment.id, studentId: student.id } };
  const [previous, submission] = await Promise.all([
    db.grade.findUnique({ where: key }),
    db.submission.findUnique({ where: key, select: { id: true } }),
  ]);
  const previousMark = previous ? toMark(previous.mark) : null;

  const grade = await db.$transaction(async (tx) => {
    const g = await tx.grade.upsert({
      where: key,
      create: { assessmentId: assessment.id, studentId: student.id, mark: input.mark },
      update: { mark: input.mark },
    });
    if (previousMark !== input.mark) {
      const published = student.resultRelease?.status === "PUBLISHED";
      await audit(tx, {
        actor,
        action: previous ? "grade.changed" : "grade.entered",
        entityType: "Grade",
        entityId: g.id,
        studentId: student.id,
        details: {
          assessmentId: assessment.id,
          ...(previous ? { from: previousMark, to: input.mark } : { mark: input.mark }),
          // A change to already-published results is the kind of thing an external examiner asks about.
          ...(published && { afterPublication: true }),
        },
      });
      if (published && previous) logger.warn("grade changed after publication", { studentId: student.id, gradeId: g.id });
    }
    return g;
  });

  return { ...grade, mark: toMark(grade.mark), classification: classify(input.mark), hasSubmission: submission !== null };
}

async function gradesFor(studentId: string) {
  const grades = await db.grade.findMany({
    where: { studentId },
    include: { assessment: { include: { module: { select: { code: true, title: true } } } } },
    orderBy: [{ assessment: { deadline: "asc" } }, { assessment: { createdAt: "asc" } }],
  });
  return grades.map((g) => {
    const mark = toMark(g.mark);
    return {
      id: g.id,
      assessmentId: g.assessmentId,
      assessmentTitle: g.assessment.title,
      moduleCode: g.assessment.module.code,
      moduleTitle: g.assessment.module.title,
      mark,
      classification: classify(mark) as Classification,
      updatedAt: g.updatedAt,
    };
  });
}

export type StudentResults =
  | { status: "WITHHELD"; reason: string | null }
  | {
      status: "PUBLISHED";
      publishedAt: Date | null;
      grades: Awaited<ReturnType<typeof gradesFor>>;
      average: number | null;
      overall: Classification | null;
    };

/**
 * The ONLY function the student-facing API uses to read results.
 * Withheld results return no marks at all — filtering happens here on the
 * server, never by hiding data in the browser.
 */
export async function getStudentResults(studentId: string): Promise<StudentResults> {
  const release = await db.resultRelease.findUnique({ where: { studentId } });
  if (!release || release.status !== "PUBLISHED") {
    return { status: "WITHHELD", reason: release?.shareReason ? release.reason : null };
  }
  const grades = await gradesFor(studentId);
  const average = averageMark(grades.map((g) => g.mark));
  return { status: "PUBLISHED", publishedAt: release.publishedAt, grades, average, overall: average === null ? null : classify(average) };
}

export async function getStaffMarksheet(studentId: string) {
  const release = await db.resultRelease.findUnique({ where: { studentId } });
  if (!release) throw new NotFoundError("Student");
  const grades = await gradesFor(studentId);
  const average = averageMark(grades.map((g) => g.mark));
  return { release, grades, average, overall: average === null ? null : classify(average) };
}

export async function publishResults(studentId: string, actor: string) {
  const release = await db.resultRelease.findUnique({ where: { studentId } });
  if (!release) throw new NotFoundError("Student");
  const gradeCount = await db.grade.count({ where: { studentId } });
  if (gradeCount === 0) throw new BusinessRuleError("There are no grades to publish for this student yet");

  return db.$transaction(async (tx) => {
    const r = await tx.resultRelease.update({
      where: { studentId },
      data: { status: "PUBLISHED", publishedAt: new Date(), reason: null, shareReason: false },
    });
    await audit(tx, { actor, action: "results.published", entityType: "ResultRelease", entityId: studentId, studentId, details: { gradeCount } });
    return r;
  });
}

export async function withholdResults(studentId: string, input: WithholdResultsInput, actor: string) {
  const release = await db.resultRelease.findUnique({ where: { studentId } });
  if (!release) throw new NotFoundError("Student");
  return db.$transaction(async (tx) => {
    const r = await tx.resultRelease.update({
      where: { studentId },
      data: { status: "WITHHELD", reason: input.reason, shareReason: input.shareReason },
    });
    await audit(tx, {
      actor,
      action: "results.withheld",
      entityType: "ResultRelease",
      entityId: studentId,
      studentId,
      details: { reason: input.reason, shareReason: input.shareReason, wasPublished: release.status === "PUBLISHED" },
    });
    return r;
  });
}

/** For the staff Results page and dashboard: who has marks that students can't see yet. */
export async function listReleaseOverview() {
  const students = await db.student.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      studentNumber: true,
      fullName: true,
      status: true,
      programme: { select: { code: true } },
      resultRelease: true,
      _count: { select: { grades: true } },
    },
  });
  return students.map(({ _count, resultRelease, ...s }) => {
    const releaseStatus = resultRelease?.status ?? "WITHHELD";
    return {
      ...s,
      gradeCount: _count.grades,
      releaseStatus,
      reason: resultRelease?.reason ?? null,
      publishedAt: resultRelease?.publishedAt ?? null,
      awaitingRelease: releaseStatus === "WITHHELD" && _count.grades > 0,
    };
  });
}
