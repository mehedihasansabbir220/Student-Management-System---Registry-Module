import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CalendarClock, CircleAlert, GraduationCap, PoundSterling, Users } from "lucide-react";
import { getDashboard } from "@/server/services/dashboard";
import { requirePagePermission } from "@/server/session";
import { formatGBP } from "@/domain/money";
import { dashboardKpisFor, dashboardSectionsFor, type DashboardKpi, type DashboardSection } from "@/lib/dashboard-sections";
import { formatDate, formatDateTime, relativeToNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/badges";
import { EmptyState, Notice, PageHeader, StatCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const th = "h-9 text-xs font-medium text-muted-foreground";
const link = "font-medium text-primary hover:underline";

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard() {
  const viewer = await requirePagePermission("dashboard.read");
  const d = await getDashboard();
  const now = new Date();
  const firstName = viewer.name.split(/\s+/)[0];

  const kpis: Record<DashboardKpi, ReactNode> = {
    enrolled: (
      <StatCard
        label="Enrolled students"
        icon={Users}
        value={d.statusCounts.ENROLLED}
        hint={`${d.statusCounts.DEFERRED} deferred · ${d.statusCounts.WITHDRAWN} withdrawn · ${d.statusCounts.COMPLETED} completed`}
        href="/staff/students?status=ENROLLED"
      />
    ),
    overdue: (
      <StatCard label="Overdue balances" icon={CircleAlert} value={d.overdue.length} tone={d.overdue.length ? "red" : "green"} hint={`${formatGBP(d.overdueTotalPence)} overdue`} href="#overdue" />
    ),
    awaitingRelease: (
      <StatCard label="Results awaiting release" icon={GraduationCap} value={d.awaitingRelease.length} tone={d.awaitingRelease.length ? "amber" : undefined} hint="Graded but withheld" href="/staff/results?filter=awaiting" />
    ),
    outstanding: (
      <StatCard label="Outstanding fees" icon={PoundSterling} value={formatGBP(d.finance.outstandingPence)} hint={`${formatGBP(d.finance.collectedPence)} collected of ${formatGBP(d.finance.billedPence)}`} />
    ),
    deadlines: (
      <StatCard label="Deadlines this week" icon={CalendarClock} value={d.upcomingDeadlines.length} hint={`${d.lateSubmissions.length} recent late submissions`} href="#deadlines" />
    ),
  };

  const sections: Record<DashboardSection, ReactNode> = {
    overdue: (
      <Card id="overdue" className="scroll-mt-20 gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Overdue balances</CardTitle>
          <CardDescription>Oldest first. Payments are allocated to the oldest charges.</CardDescription>
        </CardHeader>
        {d.overdue.length === 0 ? (
          <div className="p-5"><EmptyState title="No overdue balances">Every student is up to date with their payments.</EmptyState></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={th}>Student</TableHead>
                <TableHead className={th}>Programme</TableHead>
                <TableHead className={th}>Status</TableHead>
                <TableHead className={cn(th, "text-right")}>Overdue</TableHead>
                <TableHead className={th}>Oldest due</TableHead>
                <TableHead className={th}><span className="sr-only">Action</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.overdue.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link href={`/staff/students/${o.id}`} className={link}>{o.fullName}</Link>
                    <div className="font-mono text-xs text-muted-foreground">{o.studentNumber}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{o.programme.code}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-rose-600 dark:text-rose-400">{formatGBP(o.overduePence)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(o.oldestOverdueDueDate)} <span className="text-xs">({o.daysOverdue} days)</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline"><Link href={`/staff/students/${o.id}?tab=finance`}>Record payment</Link></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    ),
    awaitingRelease: (
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Results awaiting release</CardTitle>
          <CardAction><Link href="/staff/results?filter=awaiting" className="text-sm font-medium text-primary hover:underline">Open release</Link></CardAction>
        </CardHeader>
        {d.awaitingRelease.length === 0 ? (
          <div className="p-5"><EmptyState title="Nothing waiting" /></div>
        ) : (
          <ul className="divide-y">
            {d.awaitingRelease.map((r) => (
              <li key={r.id} className="px-5 py-3">
                <Link href={`/staff/students/${r.id}?tab=results`} className={link}>{r.fullName}</Link>
                <div className="text-xs text-muted-foreground">
                  {r.gradeCount} grade{r.gradeCount === 1 ? "" : "s"}
                  {r.reason ? ` · ${r.reason}` : " · not yet reviewed"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    ),
    deadlines: (
      <Card id="deadlines" className="scroll-mt-20 gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Deadlines in the next 7 days</CardTitle>
        </CardHeader>
        {d.upcomingDeadlines.length === 0 ? (
          <div className="p-5"><EmptyState title="No deadlines this week" /></div>
        ) : (
          <ul className="divide-y">
            {d.upcomingDeadlines.map((a) => (
              <li key={a.id} className="px-5 py-3">
                <Link href={`/staff/assessments/${a.id}`} className={link}>{a.title}</Link>
                <div className="text-xs text-muted-foreground">{a.module.code} · due {relativeToNow(a.deadline, now)}</div>
                <div className="mt-1 text-xs">
                  <span className="text-emerald-700 dark:text-emerald-400">{a.counts.onTime + a.counts.late} submitted</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className={a.counts.missing ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>{a.counts.missing} outstanding</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    ),
    late: (
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Recent late submissions</CardTitle>
        </CardHeader>
        {d.lateSubmissions.length === 0 ? (
          <div className="p-5"><EmptyState title="No late submissions" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={th}>Student</TableHead>
                <TableHead className={th}>Assessment</TableHead>
                <TableHead className={th}>Submitted</TableHead>
                <TableHead className={th}>Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.lateSubmissions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell><Link href={`/staff/students/${s.student.id}`} className={link}>{s.student.fullName}</Link></TableCell>
                  <TableCell><Link href={`/staff/assessments/${s.assessment.id}`} className="hover:underline">{s.assessment.title}</Link></TableCell>
                  <TableCell className="text-rose-700 dark:text-rose-400">{formatDateTime(s.submittedAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(s.assessment.deadline)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    ),
  };

  const kpiList = dashboardKpisFor(viewer.role);
  const showCredit = kpiList.includes("outstanding") && d.finance.creditPence > 0;

  return (
    <>
      <PageHeader title={`${greeting(now)}, ${firstName}`} subtitle={`What needs attention today · ${formatDate(now)}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {kpiList.map((k) => <div key={k}>{kpis[k]}</div>)}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {dashboardSectionsFor(viewer.role).map((s) => <div key={s} className={cn("grid", (s === "overdue" || s === "late") && "lg:col-span-2")}>{sections[s]}</div>)}
      </div>

      {showCredit && (
        <Notice tone="blue" className="mt-6">
          {formatGBP(d.finance.creditPence)} is held as credit from overpayments. Consider refunding it or carrying it forward.
        </Notice>
      )}
    </>
  );
}
