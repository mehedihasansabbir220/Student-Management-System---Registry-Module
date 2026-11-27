import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, CircleCheck, GraduationCap, PoundSterling } from "lucide-react";
import { currentStudentOrRedirect } from "@/server/current-student";
import { getStudent } from "@/server/services/students";
import { listAssessmentsForStudent } from "@/server/services/assessments";
import { getStudentResults } from "@/server/services/results";
import { formatGBP } from "@/domain/money";
import { countdown } from "@/lib/countdown";
import { formatDate, formatDateTime, STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusBadge, WindowBadge } from "@/components/badges";
import { DescriptionList, Notice, PageHeader, StatCard } from "@/components/common";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

export default async function StudentHome() {
  const user = await currentStudentOrRedirect();
  const [s, assessments, results] = await Promise.all([getStudent(user.studentId), listAssessmentsForStudent(user.studentId), getStudentResults(user.studentId)]);
  const now = new Date();
  const a = s.account;
  const todo = assessments.filter((x) => x.canSubmit && !x.submission);
  const urgent = todo.filter((x) => countdown(x.deadline, now).urgent);
  const upcoming = assessments.filter((x) => x.window !== "CLOSED").slice(0, 5);

  return (
    <>
      <PageHeader title={`Hello, ${s.fullName.split(" ")[0]}`} subtitle={<><span className="font-mono">{s.studentNumber}</span> · {s.programme.name}</>} />

      <div className="mb-6 grid gap-3">
        {s.status !== "ENROLLED" && (
          <Notice tone={s.status === "WITHDRAWN" ? "red" : "blue"}>
            Your enrolment status is <strong>{STATUS_LABEL[s.status]}</strong>. You can view your record but cannot submit work. Contact the Registry if this is wrong.
          </Notice>
        )}
        {a.isOverdue && (
          <Notice tone="red">
            {formatGBP(a.overduePence)} has been overdue since {formatDate(a.oldestOverdueDueDate)}. <Link href="/me/fees" className="font-medium underline underline-offset-4">View your fees</Link>
          </Notice>
        )}
        {urgent.map((x) => (
          <Notice key={x.id} tone="amber">
            <strong>{x.title}</strong> is {countdown(x.deadline, now).label.toLowerCase()} and you haven&apos;t submitted yet. <Link href="/me/assessments" className="font-medium underline underline-offset-4">Submit now</Link>
          </Notice>
        ))}
        {results.status === "PUBLISHED" && (
          <Notice tone="green">
            Your results have been published. <Link href="/me/results" className="font-medium underline underline-offset-4">See your results</Link>
          </Notice>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={a.creditPence ? "Account credit" : "Balance to pay"}
          icon={PoundSterling}
          value={formatGBP(a.creditPence || a.balancePence)}
          tone={a.isOverdue ? "red" : a.balancePence === 0 ? "green" : "amber"}
          hint={a.isOverdue ? `${formatGBP(a.overduePence)} overdue` : a.balancePence === 0 ? "Nothing to pay" : "Not yet due"}
          href="/me/fees"
        />
        <StatCard
          label="Work to submit"
          icon={CalendarClock}
          value={todo.length}
          tone={todo.length ? "amber" : "green"}
          hint={todo[0] ? `Next: ${todo[0].title}, ${countdown(todo[0].deadline, now).label.toLowerCase()}` : "All caught up"}
          href="/me/assessments"
        />
        <StatCard label="Results" icon={GraduationCap} value={results.status === "PUBLISHED" ? "Available" : "Not yet released"} tone={results.status === "PUBLISHED" ? "green" : undefined} href="/me/results" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Upcoming deadlines</CardTitle>
            <CardAction><Link href="/me/assessments" className="text-sm font-medium text-primary hover:underline">All coursework</Link></CardAction>
          </CardHeader>
          {upcoming.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">No upcoming deadlines</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((x) => {
                const due = countdown(x.deadline, now);
                return (
                  <li key={x.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <Link href="/me/assessments" className="font-medium text-primary hover:underline">{x.title}</Link>
                      <div className={cn("text-xs text-muted-foreground", due.urgent && !x.submission && "font-medium text-amber-700 dark:text-amber-400")}>
                        {x.module.code} · {formatDateTime(x.deadline)} · {due.label}
                      </div>
                    </div>
                    {x.submission ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400"><CircleCheck className="size-3.5" /> Submitted</span>
                    ) : (
                      <WindowBadge window={x.window} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>My details</CardTitle>
          </CardHeader>
          <CardContent>
            <DescriptionList
              items={[
                ["Student ID", <span key="id" className="font-mono">{s.studentNumber}</span>],
                ["Status", <StatusBadge key="st" status={s.status} />],
                ["Email", s.email],
                ["Date of birth", formatDate(s.dateOfBirth)],
                ["Programme", s.programme.name],
                ["Academic year", s.academicYear],
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
