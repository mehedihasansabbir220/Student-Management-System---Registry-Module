import Link from "next/link";
import type { Metadata } from "next";
import { currentStudentOrRedirect } from "@/server/current-student";
import { getStudent } from "@/server/services/students";
import { listAssessmentsForStudent } from "@/server/services/assessments";
import { getStudentResults } from "@/server/services/results";
import { Card, DescriptionList, Notice, PageHeader, Stat } from "@/components/ui";
import { StatusBadge, WindowBadge } from "@/components/badges";
import { formatGBP } from "@/domain/money";
import { formatDate, formatDateTime, relativeToNow } from "@/lib/format";

export const metadata: Metadata = { title: "My overview" };
export const dynamic = "force-dynamic";

export default async function StudentHome() {
  const user = await currentStudentOrRedirect();
  const [s, assessments, results] = await Promise.all([getStudent(user.studentId), listAssessmentsForStudent(user.studentId), getStudentResults(user.studentId)]);
  const todo = assessments.filter((a) => a.canSubmit && !a.submission);
  const a = s.account;

  return (
    <>
      <PageHeader title={`Hello, ${s.fullName.split(" ")[0]}`} subtitle={<><span className="font-mono">{s.studentNumber}</span> · {s.programme.name}</>} />

      {s.status !== "ENROLLED" && (
        <div className="mb-4">
          <Notice tone={s.status === "WITHDRAWN" ? "red" : "blue"}>
            Your enrolment status is <strong><StatusLabelText status={s.status} /></strong>. You can view your record but cannot submit work. Contact the Registry if this is wrong.
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label={a.creditPence ? "Account credit" : "Balance to pay"} value={formatGBP(a.creditPence || a.balancePence)} tone={a.isOverdue ? "red" : a.balancePence === 0 ? "green" : "amber"} hint={a.isOverdue ? `${formatGBP(a.overduePence)} overdue` : a.balancePence === 0 ? "Nothing to pay" : "Not yet due"} href="/me/fees" />
        <Stat label="Work to submit" value={todo.length} tone={todo.length ? "amber" : "green"} hint={todo[0] ? `Next: ${todo[0].title} ${relativeToNow(todo[0].deadline)}` : "All caught up"} href="/me/assessments" />
        <Stat label="Results" value={results.status === "PUBLISHED" ? "Available" : "Not yet released"} tone={results.status === "PUBLISHED" ? "green" : undefined} href="/me/results" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="My details">
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
        </Card>
        <Card title="Upcoming deadlines" padded={false}>
          <ul className="divide-y divide-slate-100">
            {assessments.filter((x) => x.window !== "CLOSED").slice(0, 5).map((x) => (
              <li key={x.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <Link href="/me/assessments" className="link">{x.title}</Link>
                  <div className="text-xs text-slate-500">{x.module.code} · {formatDateTime(x.deadline)}</div>
                </div>
                {x.submission ? <span className="text-xs text-emerald-700">Submitted ✓</span> : <WindowBadge window={x.window} />}
              </li>
            ))}
            {assessments.every((x) => x.window === "CLOSED") && <li className="px-5 py-6 text-center text-sm text-slate-500">No upcoming deadlines</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}

function StatusLabelText({ status }: { status: string }) {
  return <>{status.charAt(0) + status.slice(1).toLowerCase()}</>;
}
