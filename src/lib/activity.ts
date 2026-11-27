import { can, type Role } from "@/domain/permissions";

/**
 * The student record's activity list mirrors its tabs: no payment details for
 * academics, no marks or submissions for finance.
 */
const FINANCE_ACTIONS = new Set(["fee.added", "payment.recorded", "payment.voided"]);
const ACADEMIC_ACTIONS = new Set(["grade.entered", "grade.changed", "results.published", "results.withheld", "submission.created", "submission.replaced"]);

export function visibleActivity<T extends { action: string }>(logs: T[], role: Role): T[] {
  return logs.filter((l) => (can(role, "finance.read") || !FINANCE_ACTIONS.has(l.action)) && (can(role, "results.read") || !ACADEMIC_ACTIONS.has(l.action)));
}

const LABEL: Record<string, string> = {
  "student.created": "Enrolled",
  "student.updated": "Details updated",
  "student.status_changed": "Status changed",
  "fee.added": "Fee added",
  "payment.recorded": "Payment recorded",
  "payment.voided": "Payment voided",
  "submission.created": "Submitted work",
  "submission.replaced": "Resubmitted work",
  "grade.entered": "Grade entered",
  "grade.changed": "Grade changed",
  "results.published": "Results published",
  "results.withheld": "Results withheld",
  "account.activated": "Portal account activated",
  "account.activation_issued": "Activation link issued",
  "account.password_changed": "Password changed",
};

export function activityLabel(action: string): string {
  return LABEL[action] ?? action;
}

/** One-line summary of an audit entry's details, or null when there's nothing useful to show. */
export function describeActivity(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  if (d.from !== undefined && d.to !== undefined) return `${String(d.from)} → ${String(d.to)}`;
  if (d.reason) return String(d.reason);
  if (d.amount && d.reference) return `£${String(d.amount)} · ${String(d.reference)}`;
  if (d.mark !== undefined) return `Mark ${String(d.mark)}`;
  if (Array.isArray(d.fields)) return d.fields.join(", ");
  return null;
}
