import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAssessmentRoster } from "@/server/services/assessments";
import { NotFoundError } from "@/server/errors";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { ReleaseBadge, StatusBadge, SubmissionBadge, WindowBadge } from "@/components/badges";
import { assessmentWindow } from "@/domain/submissions";
import { formatDateTime, relativeToNow } from "@/lib/format";
import { GradeCell } from "./grade-cell";
import { DeadlineEditor } from "./deadline-editor";
import { requirePagePermission } from "@/server/session";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  try {
    return await getAssessmentRoster(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // NB: no loading.tsx above this route on purpose — a Suspense boundary would flush
  // a 200 before notFound() runs, and unknown records must return a real 404.
  const r = await load((await params).id);
  return { title: r.assessment.title };
}

export default async function AssessmentPage({ params }: Props) {
  await requirePagePermission("submissions.read");
  const { assessment, rows, counts } = await load((await params).id);
  const now = new Date();

  return (
    <>
      <PageHeader
        back={{ href: "/staff/assessments", label: "Assessments" }}
        title={<span className="flex flex-wrap items-center gap-3">{assessment.title} <WindowBadge window={assessmentWindow(assessment.deadline, now)} /></span>}
        subtitle={`${assessment.module.code} ${assessment.module.title} · ${assessment.module.programme.name} · due ${formatDateTime(assessment.deadline)} (${relativeToNow(assessment.deadline, now)})`}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="On time" value={counts.onTime} tone="green" />
        <Stat label="Late" value={counts.late} tone={counts.late ? "red" : undefined} />
        <Stat label="Not submitted" value={counts.missing} tone={counts.missing ? "amber" : undefined} />
        <Stat label="Graded" value={`${rows.filter((r) => r.grade).length}/${counts.total}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card title="Submissions & marks" padded={false} className="lg:col-span-3">
          {rows.length === 0 ? (
            <div className="p-6"><EmptyState title="No students on this programme" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data">
                <thead><tr><th>Student</th><th>Submission</th><th>File</th><th className="w-56">Mark (0–100)</th><th>Results</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/staff/students/${r.id}`} className="link">{r.fullName}</Link>
                        <div className="flex items-center gap-2 font-mono text-xs text-slate-500">{r.studentNumber} {r.status !== "ENROLLED" && <StatusBadge status={r.status} />}</div>
                      </td>
                      <td>
                        <SubmissionBadge state={r.submissionState} />
                        {r.submission && <div className="mt-1 text-xs text-slate-500">{formatDateTime(r.submission.submittedAt)}{r.submission.version > 1 && ` · v${r.submission.version}`}</div>}
                      </td>
                      <td>{r.submission ? <a className="link text-xs" href={`/api/submissions/${r.submission.id}/file`}>{r.submission.originalName}</a> : <span className="text-xs text-slate-400">—</span>}</td>
                      <td>
                        <GradeCell assessmentId={assessment.id} studentId={r.id} initial={r.grade ? Number(r.grade.mark) : null} hasSubmission={!!r.submission} />
                      </td>
                      <td><ReleaseBadge status={r.resultRelease?.status ?? "WITHHELD"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Deadline">
          <DeadlineEditor assessmentId={assessment.id} deadline={assessment.deadline.toISOString()} />
        </Card>
      </div>
    </>
  );
}
