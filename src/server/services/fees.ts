import "server-only";
import { db } from "../db";
import { audit } from "../audit";
import { BusinessRuleError, NotFoundError } from "../errors";
import { logger } from "../logger";
import { rethrowUnique } from "../prisma-errors";
import type { AddFeeInput, RecordPaymentInput } from "@/lib/validation";
import { accountFor, accountSelect } from "./accounts";

const REFERENCE_TAKEN = "A payment with this reference has already been recorded";

async function assertStudent(studentId: string) {
  const s = await db.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!s) throw new NotFoundError("Student");
}

export async function getAccount(studentId: string, today = new Date()) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      fees: { orderBy: { dueDate: "asc" } },
      payments: { orderBy: [{ paidOn: "desc" }, { recordedAt: "desc" }] },
    },
  });
  if (!student) throw new NotFoundError("Student");
  return { fees: student.fees, payments: student.payments, account: accountFor(student.fees, student.payments, today) };
}

export async function recordPayment(studentId: string, input: RecordPaymentInput, actor: string, today = new Date()) {
  await assertStudent(studentId);
  try {
    const payment = await db.$transaction(async (tx) => {
      const p = await tx.payment.create({ data: { studentId, ...input } });
      await audit(tx, {
        actor,
        action: "payment.recorded",
        entityType: "Payment",
        entityId: p.id,
        studentId,
        details: { amount: input.amount, reference: input.reference, method: input.method },
      });
      return p;
    });
    logger.info("payment recorded", { studentId, paymentId: payment.id, amount: input.amount });
    const { account } = await getAccount(studentId, today);
    return { payment, account };
  } catch (err) {
    rethrowUnique(err, { reference: REFERENCE_TAKEN });
  }
}

/** Payments are never deleted. Voiding is atomic: a concurrent second void finds nothing to update. */
export async function voidPayment(paymentId: string, reason: string, actor: string) {
  const existing = await db.payment.findUnique({ where: { id: paymentId } });
  if (!existing) throw new NotFoundError("Payment");

  return db.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, voidedAt: null },
      data: { voidedAt: new Date(), voidReason: reason },
    });
    if (count === 0) throw new BusinessRuleError("This payment has already been voided");
    await audit(tx, {
      actor,
      action: "payment.voided",
      entityType: "Payment",
      entityId: paymentId,
      studentId: existing.studentId,
      details: { reason, amount: existing.amount.toString(), reference: existing.reference },
    });
    return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  });
}

export async function addFee(studentId: string, input: AddFeeInput, actor: string, today = new Date()) {
  const student = await db.student.findUnique({ where: { id: studentId }, select: { academicYear: true } });
  if (!student) throw new NotFoundError("Student");
  await db.$transaction(async (tx) => {
    const fee = await tx.fee.create({ data: { studentId, academicYear: student.academicYear, ...input } });
    await audit(tx, {
      actor,
      action: "fee.added",
      entityType: "Fee",
      entityId: fee.id,
      studentId,
      details: { description: input.description, amount: input.amount },
    });
  });
  return getAccount(studentId, today);
}

/**
 * Overdue = unpaid money on a fee whose due date has passed (FIFO allocation).
 * The DB pre-filters to students with at least one past-due fee; the exact
 * calculation happens in the domain layer. For a very large registry this would
 * move into a SQL view — at registry scale (thousands of students) this is fine.
 */
export async function listOverdueStudents(today = new Date()) {
  const startOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const candidates = await db.student.findMany({
    where: { fees: { some: { dueDate: { lt: startOfToday } } } },
    select: {
      id: true,
      studentNumber: true,
      fullName: true,
      status: true,
      programme: { select: { code: true, name: true } },
      ...accountSelect,
    },
  });

  return candidates
    .map(({ fees, payments, ...s }) => {
      const account = accountFor(fees, payments, today);
      return { ...s, ...account };
    })
    .filter((r) => r.isOverdue)
    .sort((a, b) => b.overduePence - a.overduePence || b.daysOverdue - a.daysOverdue);
}
