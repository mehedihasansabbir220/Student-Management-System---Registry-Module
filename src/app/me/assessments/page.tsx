import type { Metadata } from "next";
import { BookOpenCheck, Clock, FileText } from "lucide-react";
import { currentStudentOrRedirect } from "@/server/current-student";
import { listAssessmentsForStudent } from "@/server/services/assessments";
import { config } from "@/server/config";
import { countdown } from "@/lib/countdown";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SubmissionBadge, WindowBadge } from "@/components/badges";
import { EmptyState, PageHeader } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Coursework" };
export const dynamic = "force-dynamic";

export default async function MyAssessments() {
  const user = await currentStudentOrRedirect();
  const items = await listAssessmentsForStudent(user.studentId);
  const now = new Date();
  const { maxUploadMb } = config();

  return (
    <>
      <PageHeader title="Coursework" subtitle={`Upload PDF or DOCX files (max ${maxUploadMb} MB). You can resubmit until the deadline.`} />
      {items.length === 0 ? (
        <EmptyState title="No assessments have been set for your programme yet" icon={BookOpenCheck} />
      ) : (
        <div className="grid gap-4">
          {items.map((a) => {
            const due = countdown(a.deadline, now);
            return (
              <Card key={a.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {a.title} <WindowBadge window={a.window} />
                  </CardTitle>
                  <CardDescription>
                    {a.module.code} {a.module.title}
                    <span className={cn("mt-1 flex items-center gap-1.5", due.urgent && "font-medium text-amber-700 dark:text-amber-400")}>
                      <Clock className="size-3.5" /> Due {formatDateTime(a.deadline)} · {due.label}
                    </span>
                  </CardDescription>
                  <CardAction className="text-right">
                    <SubmissionBadge state={a.submission ? (a.submission.isLate ? "LATE" : "ON_TIME") : "MISSING"} />
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {a.submission && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                      <a className="inline-flex min-w-0 items-center gap-1.5 font-medium text-primary hover:underline" href={`/api/submissions/${a.submission.id}/file`}>
                        <FileText className="size-4 shrink-0" /> <span className="truncate">{a.submission.originalName}</span>
                      </a>
                      <span className="text-xs text-muted-foreground">
                        Submitted {formatDateTime(a.submission.submittedAt)}
                        {a.submission.version > 1 && ` · version ${a.submission.version}`}
                      </span>
                    </div>
                  )}
                  {a.canSubmit ? (
                    <UploadForm assessmentId={a.id} title={a.title} isResubmission={!!a.submission} willBeLate={a.willBeLate} maxMb={maxUploadMb} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{a.blockedReason}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
