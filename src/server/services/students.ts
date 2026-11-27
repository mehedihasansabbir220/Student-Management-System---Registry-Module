import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { audit } from "../audit";
import { NotFoundError, ValidationError } from "../errors";
import { logger } from "../logger";
import { rethrowUnique } from "../prisma-errors";
import { formatStudentNumber, intakeYear } from "@/domain/student-number";
import type { CreateStudentInput, StudentListQuery, UpdateStudentInput } from "@/lib/validation";
import { accountFor, accountSelect } from "./accounts";

/** Fee due date policy: 30 days after enrolment (see doc/05). */
export const FEE_DUE_DAYS = 30;
const EMAIL_TAKEN = "A student with this email already exists";

const addDaysUtc = (d: Date, days: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));

/**
 * Enrol a student. In ONE transaction:
 *   1. atomically bump the per-year ID sequence (row lock serialises concurrent enrolments)
 *   2. create the student
 *   3. snapshot the programme fee onto a Fee row
 *   4. create the (withheld) result release
 *   5. audit
 * If anything fails, everything rolls back — including the sequence, so IDs are not burnt.
 */
export async function createStudent(input: CreateStudentInput, actor: string, now = new Date()) {
  const programme = await db.programme.findUnique({ where: { id: input.programmeId } });
  if (!programme) throw new ValidationError("Programme not found", { programmeId: "Choose a valid programme" });

  const year = intakeYear(input.academicYear);
  try {
    const student = await db.$transaction(async (tx) => {
      const seq = await tx.studentIdSequence.upsert({
        where: { year },
        create: { year, lastValue: 1 },
        update: { lastValue: { increment: 1 } },
      });

      const created = await tx.student.create({
        data: {
          studentNumber: formatStudentNumber(year, seq.lastValue),
          fullName: input.fullName,
          email: input.email,
          dateOfBirth: input.dateOfBirth,
          programmeId: programme.id,
          academicYear: input.academicYear,
          status: input.status,
        },
      });

      await tx.fee.create({
        data: {
          studentId: created.id,
          description: `Tuition fee ${input.academicYear} — ${programme.name}`,
          amount: programme.feeAmount,
          dueDate: addDaysUtc(now, FEE_DUE_DAYS),
          academicYear: input.academicYear,
        },
      });
      await tx.resultRelease.create({ data: { studentId: created.id } });
      await audit(tx, {
        actor,
        action: "student.created",
        entityType: "Student",
        entityId: created.id,
        studentId: created.id,
        details: { studentNumber: created.studentNumber, programme: programme.code, feeAmount: programme.feeAmount.toString() },
      });
      return created;
    });
    logger.info("student enrolled", { studentId: student.id, studentNumber: student.studentNumber });
    return student;
  } catch (err) {
    rethrowUnique(err, { email: EMAIL_TAKEN });
  }
}

export async function listStudents(query: StudentListQuery, today = new Date()) {
  const where: Prisma.StudentWhereInput = {
    programmeId: query.programmeId,
    status: query.status,
    academicYear: query.academicYear,
    ...(query.q && {
      OR: [
        { fullName: { contains: query.q, mode: "insensitive" } },
        { studentNumber: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
      ],
    }),
  };

  const [total, rows] = await db.$transaction([
    db.student.count({ where }),
    db.student.findMany({
      where,
      orderBy: [{ fullName: "asc" }, { studentNumber: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { programme: { select: { id: true, code: true, name: true } }, ...accountSelect },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
    items: rows.map(({ fees, payments, ...s }) => ({ ...s, account: accountFor(fees, payments, today) })),
  };
}

export async function getStudent(id: string, today = new Date()) {
  const student = await db.student.findUnique({
    where: { id },
    include: {
      programme: true,
      fees: { orderBy: { dueDate: "asc" } },
      payments: { orderBy: [{ paidOn: "desc" }, { recordedAt: "desc" }] },
      resultRelease: true,
      auditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!student) throw new NotFoundError("Student");
  return { ...student, account: accountFor(student.fees, student.payments, today) };
}

export async function updateStudent(id: string, input: UpdateStudentInput, actor: string) {
  const existing = await db.student.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Student");

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.student.update({ where: { id }, data: input });

      const changed = (Object.keys(input) as (keyof UpdateStudentInput)[]).filter(
        (k) => input[k] !== undefined && String(existing[k]) !== String(updated[k]),
      );
      if (changed.length) {
        await audit(tx, { actor, action: "student.updated", entityType: "Student", entityId: id, studentId: id, details: { fields: changed } });
      }
      if (input.status && input.status !== existing.status) {
        await audit(tx, {
          actor,
          action: "student.status_changed",
          entityType: "Student",
          entityId: id,
          studentId: id,
          details: { from: existing.status, to: input.status },
        });
      }
      return updated;
    });
  } catch (err) {
    rethrowUnique(err, { email: EMAIL_TAKEN });
  }
}

export function listProgrammes() {
  return db.programme.findMany({ orderBy: { name: "asc" }, include: { modules: { orderBy: { code: "asc" } } } });
}
