import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FileText, Users } from "lucide-react";
import { getAssessmentRoster } from "@/server/services/assessments";
import { NotFoundError } from "@/server/errors";
import { requirePagePermission } from "@/server/session";
import { can } from "@/domain/permissions";
import { assessmentWindow } from "@/domain/submissions";
import { formatDateTime, relativeToNow } from "@/lib/format";
import { filterRoster, parseRosterState, type RosterState } from "@/lib/roster";
import { cn } from "@/lib/utils";
import { ReleaseBadge, StatusBadge, SubmissionBadge, WindowBadge } from "@/components/badges";
import { EmptyState, PageHeader, StatCard } from "@/components/common";
import { BreadcrumbTitle } from "@/components/shell/breadcrumb-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeadlineEditor } from "./deadline-editor";
import { GradeCell } from "./grade-cell";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ state?: string }> };

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

const th = "h-10 text-xs font-medium text-muted-foreground";
const FILTER_LABEL: Record<RosterState, string> = { ON_TIME: "on time", LATE: "late", MISSING: "not submitted" };

export default async function AssessmentPage({ params, searchParams }: Props) {
  const viewer = await requirePagePermission("submissions.read");
  const { id } = await params;
  const state = parseRosterState((await searchParams).state);
  const { assessment, rows, counts } = await load(id);
  const now = new Date();
  const shown = filterRoster(rows, state);
  const href = (s: RosterState) => (state === s ? `/staff/assessments/${id}` : `/staff/assessments/${id}?state=${s}`);

  return (
    <>
      <BreadcrumbTitle id={assessment.id} label={assessment.title} />
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{assessment.title} <WindowBadge window={assessmentWindow(assessment.deadline, now)} /></span>}
        subtitle={`${assessment.module.code} ${assessment.module.title} · ${assessment.module.programme.name} · due ${formatDateTime(assessment.deadline)} (${relativeToNow(assessment.deadline, now)})`}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="On time" value={counts.onTime} tone="green" href={href("ON_TIME")} />
        <StatCard label="Late" value={counts.late} tone={counts.late ? "red" : undefined} href={href("LATE")} />
        <StatCard label="Not submitted" value={counts.missing} tone={counts.missing ? "amber" : undefined} href={href("MISSING")} />
        <StatCard label="Graded" value={`${rows.filter((r) => r.grade).length}/${counts.total}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="gap-0 py-0 lg:col-span-3">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b py-4">
            <CardTitle>Submissions &amp; marks</CardTitle>
            {state && (
              <span className="text-sm text-muted-foreground">
                Showing {FILTER_LABEL[state]} only · <Link href={`/staff/assessments/${id}`} className="font-medium text-primary hover:underline">Show all</Link>
              </span>
            )}
          </CardHeader>
          {shown.length === 0 ? (
            <div className="p-6">
              <EmptyState title={rows.length === 0 ? "No students on this programme" : `No ${state ? FILTER_LABEL[state] : ""} submissions`} icon={Users} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className={th}>Student</TableHead>
                  <TableHead className={th}>Submission</TableHead>
                  <TableHead className={th}>File</TableHead>
                  <TableHead className={cn(th, "w-56")}>Mark (0–100)</TableHead>
                  <TableHead className={th}>Results</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/staff/students/${r.id}`} className="font-medium text-primary hover:underline">{r.fullName}</Link>
                      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                        {r.studentNumber} {r.status !== "ENROLLED" && <StatusBadge status={r.status} />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <SubmissionBadge state={r.submissionState} />
                      {r.submission && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(r.submission.submittedAt)}
                          {r.submission.version > 1 && ` · v${r.submission.version}`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.submission ? (
                        <a className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" href={`/api/submissions/${r.submission.id}/file`}>
                          <FileText className="size-3.5" /> {r.submission.originalName}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <GradeCell
                        assessmentId={assessment.id}
                        studentId={r.id}
                        studentName={r.fullName}
                        initial={r.grade ? Number(r.grade.mark) : null}
                        hasSubmission={!!r.submission}
                        readOnly={!can(viewer.role, "grades.write")}
                      />
                    </TableCell>
                    <TableCell><ReleaseBadge status={r.resultRelease?.status ?? "WITHHELD"} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
        {can(viewer.role, "assessments.write") && (
          <Card className="self-start">
            <CardHeader>
              <CardTitle>Deadline</CardTitle>
            </CardHeader>
            <CardContent>
              <DeadlineEditor assessmentId={assessment.id} deadline={assessment.deadline.toISOString()} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
