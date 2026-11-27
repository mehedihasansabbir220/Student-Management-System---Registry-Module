import Link from "next/link";
import type { Metadata } from "next";
import { getDashboard } from "@/server/services/dashboard";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { AccountBadge, StatusBadge } from "@/components/badges";
import { formatGBP } from "@/domain/money";
import { formatDate, formatDateTime, relativeToNow } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const d = await getDashboard();
  const active = d.statusCounts.ENROLLED;

  return (
    <>
      <PageHeader title="Registry dashboard" subtitle={`What needs attention today · ${formatDate(new Date())}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Enrolled students" value={active} hint={`${d.statusCounts.DEFERRED} deferred · ${d.statusCounts.WITHDRAWN} withdrawn · ${d.statusCounts.COMPLETED} completed`} href="/staff/students?status=ENROLLED" />
        <Stat label="Overdue balances" value={d.overdue.length} tone={d.overdue.length ? "red" : "green"} hint={formatGBP(d.overdueTotalPence) + " overdue"} href="#overdue" />
        <Stat label="Results awaiting release" value={d.awaitingRelease.length} tone={d.awaitingRelease.length ? "amber" : undefined} hint="Graded but withheld" href="/staff/results?filter=awaiting" />
        <Stat label="Outstanding fees" value={formatGBP(d.finance.outstandingPence)} hint={`${formatGBP(d.finance.collectedPence)} collected of ${formatGBP(d.finance.billedPence)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={<span id="overdue">⚠ Overdue balances</span>} className="lg:col-span-2" padded={false}>
          {d.overdue.length === 0 ? (
            <div className="p-5"><EmptyState title="No overdue balances">Every student is up to date with their payments.</EmptyState></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data">
                <thead>
                  <tr><th>Student</th><th>Programme</th><th>Status</th><th className="text-right">Overdue</th><th>Oldest due</th><th /></tr>
                </thead>
                <tbody>
                  {d.overdue.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/staff/students/${o.id}`} className="link">{o.fullName}</Link>
                        <div className="font-mono text-xs text-slate-500">{o.studentNumber}</div>
                      </td>
                      <td className="text-slate-600">{o.programme.code}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="text-right font-semibold tabular-nums text-rose-600">{formatGBP(o.overduePence)}</td>
                      <td className="text-slate-600">{formatDate(o.oldestOverdueDueDate)} <span className="text-xs text-slate-400">({o.daysOverdue} days)</span></td>
                      <td><Link href={`/staff/students/${o.id}#fees`} className="btn btn-secondary btn-sm">Record payment</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Deadlines in the next 7 days" padded={false}>
          {d.upcomingDeadlines.length === 0 ? (
            <div className="p-5"><EmptyState title="No deadlines this week" /></div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.upcomingDeadlines.map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <Link href={`/staff/assessments/${a.id}`} className="link">{a.title}</Link>
                  <div className="text-xs text-slate-500">{a.module.code} · due {relativeToNow(a.deadline)}</div>
                  <div className="mt-1 text-xs">
                    <span className="text-emerald-700">{a.counts.onTime + a.counts.late} submitted</span>
                    <span className="text-slate-400"> · </span>
                    <span className={a.counts.missing ? "text-amber-700" : "text-slate-500"}>{a.counts.missing} outstanding</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent late submissions" className="lg:col-span-2" padded={false}>
          {d.lateSubmissions.length === 0 ? (
            <div className="p-5"><EmptyState title="No late submissions" /></div>
          ) : (
            <table className="data">
              <thead><tr><th>Student</th><th>Assessment</th><th>Submitted</th><th>Deadline</th></tr></thead>
              <tbody>
                {d.lateSubmissions.map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/staff/students/${s.student.id}`} className="link">{s.student.fullName}</Link></td>
                    <td><Link href={`/staff/assessments/${s.assessment.id}`} className="text-slate-700 hover:underline">{s.assessment.title}</Link></td>
                    <td className="text-rose-700">{formatDateTime(s.submittedAt)}</td>
                    <td className="text-slate-500">{formatDateTime(s.assessment.deadline)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Results awaiting release" padded={false}>
          {d.awaitingRelease.length === 0 ? (
            <div className="p-5"><EmptyState title="Nothing waiting" /></div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.awaitingRelease.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link href={`/staff/students/${r.id}#results`} className="link">{r.fullName}</Link>
                    <div className="text-xs text-slate-500">{r.gradeCount} grade{r.gradeCount === 1 ? "" : "s"}{r.reason ? ` · ${r.reason}` : " · not yet reviewed"}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {d.finance.creditPence > 0 && (
        <p className="mt-6 text-xs text-slate-500">
          <AccountBadge state="CREDIT" /> {formatGBP(d.finance.creditPence)} is held as credit from overpayments — consider refunding or carrying it forward.
        </p>
      )}
    </>
  );
}
