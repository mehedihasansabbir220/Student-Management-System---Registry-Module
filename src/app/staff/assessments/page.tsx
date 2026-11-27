import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { listAssessmentsForStaff, listModules } from "@/server/services/assessments";
import { requirePagePermission } from "@/server/session";
import { can } from "@/domain/permissions";
import { assessmentWindow } from "@/domain/submissions";
import { formatDateTime, relativeToNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WindowBadge } from "@/components/badges";
import { EmptyState, PageHeader } from "@/components/common";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateAssessmentDialog } from "./create-assessment-dialog";

export const metadata: Metadata = { title: "Assessments" };
export const dynamic = "force-dynamic";

const th = "h-10 text-xs font-medium text-muted-foreground";

export default async function AssessmentsPage() {
  const viewer = await requirePagePermission("submissions.read");
  const canCreate = can(viewer.role, "assessments.write");
  const [assessments, modules] = await Promise.all([listAssessmentsForStaff(), canCreate ? listModules() : []]);
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Assessments"
        subtitle="Track submissions and enter marks."
        actions={canCreate ? <CreateAssessmentDialog modules={modules.map((m) => ({ id: m.id, label: `${m.code} — ${m.title} (${m.programme.code})` }))} /> : undefined}
      />
      <div className="overflow-hidden rounded-lg border bg-card">
        {assessments.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No assessments yet" icon={ClipboardList}>{canCreate ? "Create the first one with the button above." : "Assessments appear here once academic staff create them."}</EmptyState>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className={th}>Assessment</TableHead>
                <TableHead className={th}>Deadline</TableHead>
                <TableHead className={th}>Window</TableHead>
                <TableHead className={cn(th, "text-right")}>Submitted</TableHead>
                <TableHead className={cn(th, "text-right")}>Late</TableHead>
                <TableHead className={cn(th, "text-right")}>Missing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link href={`/staff/assessments/${a.id}`} className="font-medium text-primary hover:underline">{a.title}</Link>
                    <div className="text-xs text-muted-foreground">{a.module.code} {a.module.title} · {a.module.programme.code}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(a.deadline)}
                    <div className="text-xs">{relativeToNow(a.deadline, now)}</div>
                  </TableCell>
                  <TableCell><WindowBadge window={assessmentWindow(a.deadline, now)} /></TableCell>
                  <TableCell className="text-right tabular-nums">{a.counts.onTime + a.counts.late}/{a.counts.total}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", a.counts.late ? "font-semibold text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>{a.counts.late}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", a.counts.missing ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{a.counts.missing}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
