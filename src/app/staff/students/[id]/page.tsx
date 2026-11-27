import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStudent } from "@/server/services/students";
import { getStaffMarksheet } from "@/server/services/results";
import { listStudentSubmissions } from "@/server/services/submissions";
import { NotFoundError } from "@/server/errors";
import { Card, DescriptionList, EmptyState, Notice, PageHeader } from "@/components/ui";
import { AccountBadge, ClassificationBadge, ReleaseBadge, StatusBadge, SubmissionBadge } from "@/components/badges";
import { formatGBP, toPence } from "@/domain/money";
import { formatDate, formatDateTime, METHOD_LABEL } from "@/lib/format";
import { StatusEditor } from "./status-editor";
import { PaymentForm } from "./payment-form";
import { VoidPaymentButton } from "./void-payment";
import { AddFeeForm } from "./add-fee-form";
import { ReleaseControls } from "./release-controls";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

async function load(id: string) {
  try {
    return await Promise.all([getStudent(id), getStaffMarksheet(id), listStudentSubmissions(id)]);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await getStudent(id).catch(() => null);
  return { title: s ? `${s.fullName} (${s.studentNumber})` : "Student" };
}

const ACTION_LABEL: Record<string, string> = {
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
};

function describe(details: unknown) {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  if (d.from !== undefined && d.to !== undefined) return `${String(d.from)} → ${String(d.to)}`;
  if (d.reason) return String(d.reason);
  if (d.amount && d.reference) return `£${d.amount} · ${d.reference}`;
  if (d.mark !== undefined) return `Mark ${d.mark}`;
  if (d.fields) return (d.fields as string[]).join(", ");
  return null;
}

export default async function StudentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { created } = await searchParams;
  const [s, marksheet, submissions] = await load(id);
  const a = s.account;

  return (
    <>
      <PageHeader
        back={{ href: "/staff/students", label: "Students" }}
        title={<span className="flex flex-wrap items-center gap-3">{s.fullName} <StatusBadge status={s.status} /></span>}
        subtitle={<><span className="font-mono">{s.studentNumber}</span> · {s.programme.name} · {s.academicYear}</>}
      />

      {created && <div className="mb-4"><Notice tone="green">Student enrolled with ID <strong className="font-mono">{created}</strong>. The programme fee has been assigned.</Notice></div>}
      {s.status === "WITHDRAWN" && a.balancePence > 0 && (
        <div className="mb-4"><Notice tone="red">This student has withdrawn but still owes {formatGBP(a.balancePence)}. The debt remains on the account.</Notice></div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Fees & payments" actions={<AccountBadge state={a.state} daysOverdue={a.daysOverdue} creditPence={a.creditPence} />}>
            <div id="fees" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Figure label="Total fees" value={formatGBP(a.billedPence)} />
              <Figure label="Paid" value={formatGBP(a.paidPence)} />
              <Figure label={a.creditPence ? "Credit" : "Outstanding"} value={formatGBP(a.creditPence || a.balancePence)} tone={a.isOverdue ? "red" : a.creditPence ? "blue" : undefined} />
              <Figure label="Overdue" value={formatGBP(a.overduePence)} tone={a.isOverdue ? "red" : undefined} hint={a.isOverdue ? `since ${formatDate(a.oldestOverdueDueDate)}` : undefined} />
            </div>

            <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Charges</h3>
            <table className="data">
              <thead><tr><th>Description</th><th>Due</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {s.fees.map((f) => (
                  <tr key={f.id}><td>{f.description}</td><td className="text-slate-600">{formatDate(f.dueDate)}</td><td className="text-right tabular-nums">{formatGBP(toPence(f.amount))}</td></tr>
                ))}
              </tbody>
            </table>

            <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Payments</h3>
            {s.payments.length === 0 ? (
              <EmptyState title="No payments recorded" />
            ) : (
              <table className="data">
                <thead><tr><th>Date</th><th>Reference</th><th>Method</th><th className="text-right">Amount</th><th /></tr></thead>
                <tbody>
                  {s.payments.map((p) => (
                    <tr key={p.id} className={p.voidedAt ? "text-slate-400" : undefined}>
                      <td>{formatDate(p.paidOn)}</td>
                      <td className="font-mono text-xs">{p.reference}</td>
                      <td>{METHOD_LABEL[p.method]}</td>
                      <td className={`text-right tabular-nums ${p.voidedAt ? "line-through" : ""}`}>{formatGBP(toPence(p.amount))}</td>
                      <td className="text-right">
                        {p.voidedAt ? <span className="text-xs" title={p.voidReason ?? undefined}>Voided</span> : <VoidPaymentButton paymentId={p.id} reference={p.reference} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="mt-6 grid gap-6 border-t border-slate-100 pt-6 md:grid-cols-2">
              <PaymentForm studentId={s.id} balancePence={a.balancePence} />
              <AddFeeForm studentId={s.id} />
            </div>
          </Card>

          <Card title="Submissions" padded={false}>
            {submissions.length === 0 ? (
              <div className="p-5"><EmptyState title="No submissions yet" /></div>
            ) : (
              <table className="data">
                <thead><tr><th>Assessment</th><th>Submitted</th><th>State</th><th>File</th></tr></thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <Link className="link" href={`/staff/assessments/${sub.assessment.id}`}>{sub.assessment.title}</Link>
                        <div className="text-xs text-slate-500">{sub.assessment.module.code} · due {formatDateTime(sub.assessment.deadline)}</div>
                      </td>
                      <td className="text-slate-600">{formatDateTime(sub.submittedAt)}{sub.version > 1 && <div className="text-xs text-slate-400">version {sub.version}</div>}</td>
                      <td><SubmissionBadge state={sub.isLate ? "LATE" : "ON_TIME"} /></td>
                      <td><a className="link text-xs" href={`/api/submissions/${sub.id}/file`}>{sub.originalName}</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title={<span id="results">Results</span>} actions={<ReleaseBadge status={marksheet.release.status} />}>
            {marksheet.grades.length === 0 ? (
              <EmptyState title="No grades entered yet">Grades are entered from each assessment&apos;s page.</EmptyState>
            ) : (
              <>
                <table className="data">
                  <thead><tr><th>Assessment</th><th>Module</th><th className="text-right">Mark</th><th>Classification</th></tr></thead>
                  <tbody>
                    {marksheet.grades.map((g) => (
                      <tr key={g.id}>
                        <td><Link className="link" href={`/staff/assessments/${g.assessmentId}`}>{g.assessmentTitle}</Link></td>
                        <td className="text-slate-600">{g.moduleCode}</td>
                        <td className="text-right font-semibold tabular-nums">{g.mark}</td>
                        <td><ClassificationBadge value={g.classification} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {marksheet.average !== null && marksheet.overall && (
                  <p className="mt-3 text-sm text-slate-600">Average <strong className="tabular-nums">{marksheet.average}</strong> · <ClassificationBadge value={marksheet.overall} /></p>
                )}
              </>
            )}
            <div className="mt-5 border-t border-slate-100 pt-5">
              <ReleaseControls
                studentId={s.id}
                status={marksheet.release.status}
                reason={marksheet.release.reason}
                publishedAt={marksheet.release.publishedAt?.toISOString() ?? null}
                gradeCount={marksheet.grades.length}
                isOverdue={a.isOverdue}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Student details">
            <DescriptionList
              items={[
                ["Email", s.email],
                ["Date of birth", formatDate(s.dateOfBirth)],
                ["Programme", `${s.programme.code} — ${s.programme.name}`],
                ["Academic year", s.academicYear],
                ["Enrolled on", formatDate(s.createdAt)],
              ]}
            />
            <div className="mt-5 border-t border-slate-100 pt-5">
              <StatusEditor studentId={s.id} status={s.status} balancePence={a.balancePence} />
            </div>
          </Card>

          <Card title="Activity" padded={false}>
            <ol className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
              {s.auditLogs.map((l) => (
                <li key={l.id} className="px-5 py-3 text-sm">
                  <div className="font-medium text-slate-800">{ACTION_LABEL[l.action] ?? l.action}</div>
                  {describe(l.details) && <div className="text-xs text-slate-600">{describe(l.details)}</div>}
                  <div className="text-xs text-slate-400">{formatDateTime(l.createdAt)} · {l.actor}</div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}

function Figure({ label, value, tone, hint }: { label: string; value: string; tone?: "red" | "blue"; hint?: string }) {
  const color = tone === "red" ? "text-rose-600" : tone === "blue" ? "text-sky-700" : "text-slate-900";
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="text-xs text-rose-500">{hint}</div>}
    </div>
  );
}
