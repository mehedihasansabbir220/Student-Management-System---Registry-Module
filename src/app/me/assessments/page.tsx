import type { Metadata } from "next";
import { currentStudentOrRedirect } from "@/server/current-student";
import { listAssessmentsForStudent } from "@/server/services/assessments";
import { config } from "@/server/config";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SubmissionBadge, WindowBadge } from "@/components/badges";
import { formatDateTime, relativeToNow } from "@/lib/format";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "My assessments" };
export const dynamic = "force-dynamic";

export default async function MyAssessments() {
  const user = await currentStudentOrRedirect();
  const items = await listAssessmentsForStudent(user.studentId);
  const now = new Date();
  const { maxUploadMb } = config();

  return (
    <>
      <PageHeader title="My assessments" subtitle={`Upload PDF or DOCX files (max ${maxUploadMb} MB). You can resubmit until the deadline.`} />
      {items.length === 0 ? (
        <EmptyState title="No assessments have been set for your programme yet" />
      ) : (
        <div className="space-y-4">
          {items.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{a.title}</h2>
                    <WindowBadge window={a.window} />
                  </div>
                  <p className="text-sm text-slate-500">{a.module.code} {a.module.title}</p>
                  <p className={`mt-1 text-sm ${a.window === "CLOSING_SOON" ? "font-medium text-amber-700" : "text-slate-600"}`}>
                    Due {formatDateTime(a.deadline)} · {relativeToNow(a.deadline, now)}
                  </p>
                </div>
                <div className="text-right text-sm">
                  {a.submission ? (
                    <>
                      <SubmissionBadge state={a.submission.isLate ? "LATE" : "ON_TIME"} />
                      <div className="mt-1 text-xs text-slate-500">
                        <a className="link" href={`/api/submissions/${a.submission.id}/file`}>{a.submission.originalName}</a>
                        <div>{formatDateTime(a.submission.submittedAt)}{a.submission.version > 1 && ` · version ${a.submission.version}`}</div>
                      </div>
                    </>
                  ) : (
                    <SubmissionBadge state="MISSING" />
                  )}
                </div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                {a.canSubmit ? (
                  <UploadForm assessmentId={a.id} isResubmission={!!a.submission} willBeLate={a.willBeLate} maxMb={maxUploadMb} />
                ) : (
                  <p className="text-sm text-slate-500">{a.blockedReason}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
