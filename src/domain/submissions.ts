import type { EnrolmentStatus } from "@prisma/client";

export type SubmissionDecision =
  | { allowed: true; isLate: boolean; isResubmission: boolean }
  | { allowed: false; reason: string };

/**
 * Submission rules (doc/06-assessment-submission.md):
 * - Before/at deadline: submit or replace freely.
 * - After deadline with no submission: accepted, flagged late.
 * - After deadline with an existing submission: refused — on-time work is
 *   protected from being overwritten, and only one late attempt is allowed.
 * - Only ENROLLED students can submit.
 */
export function evaluateSubmission(input: {
  now: Date;
  deadline: Date;
  existing: { isLate: boolean } | null;
  studentStatus: EnrolmentStatus;
}): SubmissionDecision {
  if (input.studentStatus !== "ENROLLED") {
    return { allowed: false, reason: `Submissions are closed because your enrolment is ${input.studentStatus.toLowerCase()}` };
  }
  const late = input.now.getTime() > input.deadline.getTime();
  if (!late) return { allowed: true, isLate: false, isResubmission: input.existing !== null };
  if (input.existing) {
    return {
      allowed: false,
      reason: "The deadline has passed and you have already submitted, so your submission can no longer be replaced",
    };
  }
  return { allowed: true, isLate: true, isResubmission: false };
}

export type AssessmentWindow = "OPEN" | "CLOSING_SOON" | "CLOSED";
const CLOSING_SOON_MS = 48 * 3_600_000;

export function assessmentWindow(deadline: Date, now: Date): AssessmentWindow {
  const remaining = deadline.getTime() - now.getTime();
  if (remaining < 0) return "CLOSED";
  if (remaining <= CLOSING_SOON_MS) return "CLOSING_SOON";
  return "OPEN";
}
