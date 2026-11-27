import Link from "next/link";
import type { Metadata } from "next";
import { listAssessmentsForStaff, listModules } from "@/server/services/assessments";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { WindowBadge } from "@/components/badges";
import { assessmentWindow } from "@/domain/submissions";
import { formatDateTime, relativeToNow } from "@/lib/format";
import { CreateAssessmentForm } from "./create-assessment-form";
import { requirePagePermission } from "@/server/session";
import { can } from "@/domain/permissions";

export const metadata: Metadata = { title: "Assessments" };
export const dynamic = "force-dynamic";

export default async function AssessmentsPage() {
  const viewer = await requirePagePermission("submissions.read");
  const [assessments, modules] = await Promise.all([listAssessmentsForStaff(), listModules()]);
  const now = new Date();

  return (
    <>
      <PageHeader title="Assessments" subtitle="Create assessments, track submissions and enter marks." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card padded={false} className="lg:col-span-2">
          {assessments.length === 0 ? (
            <div className="p-6"><EmptyState title="No assessments yet">Create the first one using the form.</EmptyState></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data">
                <thead><tr><th>Assessment</th><th>Deadline</th><th>Window</th><th className="text-right">Submitted</th><th className="text-right">Late</th><th className="text-right">Missing</th></tr></thead>
                <tbody>
                  {assessments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/staff/assessments/${a.id}`} className="link">{a.title}</Link>
                        <div className="text-xs text-slate-500">{a.module.code} {a.module.title} · {a.module.programme.code}</div>
                      </td>
                      <td className="text-slate-600">{formatDateTime(a.deadline)}<div className="text-xs text-slate-400">{relativeToNow(a.deadline, now)}</div></td>
                      <td><WindowBadge window={assessmentWindow(a.deadline, now)} /></td>
                      <td className="text-right tabular-nums">{a.counts.onTime + a.counts.late}/{a.counts.total}</td>
                      <td className={`text-right tabular-nums ${a.counts.late ? "font-semibold text-rose-600" : "text-slate-400"}`}>{a.counts.late}</td>
                      <td className={`text-right tabular-nums ${a.counts.missing ? "text-amber-700" : "text-slate-400"}`}>{a.counts.missing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="New assessment">
          {can(viewer.role, "assessments.write") ? <CreateAssessmentForm modules={modules.map((m) => ({ id: m.id, label: `${m.code} — ${m.title} (${m.programme.code})` }))} /> : <p className="text-sm text-slate-500">Only academic staff and the Registry can create assessments.</p>}
        </Card>
      </div>
    </>
  );
}
