import "server-only";
import type { Prisma } from "@prisma/client";
import type { Tx } from "./db";

export type AuditAction =
  | "student.created"
  | "student.updated"
  | "student.status_changed"
  | "fee.added"
  | "payment.recorded"
  | "payment.voided"
  | "assessment.created"
  | "assessment.updated"
  | "submission.created"
  | "submission.replaced"
  | "grade.entered"
  | "grade.changed"
  | "results.published"
  | "results.withheld";

/**
 * Write an audit entry inside the same transaction as the change it describes,
 * so we never get a change without a record of it (or vice-versa).
 */
export function audit(
  tx: Tx,
  entry: {
    actor: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    studentId?: string | null;
    details?: Prisma.InputJsonValue;
  },
) {
  return tx.auditLog.create({ data: entry });
}
