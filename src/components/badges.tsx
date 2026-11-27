import { Badge } from "./ui";
import { CLASSIFICATION_LABEL, type Classification } from "@/domain/grades";
import type { AccountState } from "@/domain/fees";
import type { AssessmentWindow } from "@/domain/submissions";
import { STATUS_LABEL } from "@/lib/format";
import { formatGBP } from "@/domain/money";

type Status = keyof typeof STATUS_LABEL;

export function StatusBadge({ status }: { status: Status }) {
  const tone = { ENROLLED: "green", DEFERRED: "amber", WITHDRAWN: "red", COMPLETED: "blue" } as const;
  return <Badge tone={tone[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function AccountBadge({ state, daysOverdue, creditPence }: { state: AccountState; daysOverdue?: number; creditPence?: number }) {
  switch (state) {
    case "OVERDUE":
      return <Badge tone="red">⚠ Overdue{daysOverdue ? ` · ${daysOverdue}d` : ""}</Badge>;
    case "OUTSTANDING":
      return <Badge tone="amber">Outstanding</Badge>;
    case "CREDIT":
      return <Badge tone="blue">Credit{creditPence ? ` ${formatGBP(creditPence)}` : ""}</Badge>;
    default:
      return <Badge tone="green">Paid in full</Badge>;
  }
}

export function SubmissionBadge({ state }: { state: "ON_TIME" | "LATE" | "MISSING" }) {
  if (state === "LATE") return <Badge tone="red" title="Submitted after the deadline">Late</Badge>;
  if (state === "MISSING") return <Badge tone="slate">Not submitted</Badge>;
  return <Badge tone="green">On time</Badge>;
}

export function ClassificationBadge({ value }: { value: Classification }) {
  const tone = { FAIL: "red", PASS: "slate", MERIT: "blue", DISTINCTION: "violet" } as const;
  return <Badge tone={tone[value]}>{CLASSIFICATION_LABEL[value]}</Badge>;
}

export function ReleaseBadge({ status }: { status: "PUBLISHED" | "WITHHELD" }) {
  return status === "PUBLISHED" ? <Badge tone="green">Published</Badge> : <Badge tone="amber">Withheld</Badge>;
}

export function WindowBadge({ window }: { window: AssessmentWindow }) {
  if (window === "CLOSED") return <Badge tone="slate">Deadline passed</Badge>;
  if (window === "CLOSING_SOON") return <Badge tone="amber">Closing soon</Badge>;
  return <Badge tone="green">Open</Badge>;
}
