import Link from "next/link";
import type { Metadata } from "next";
import { listReleaseOverview } from "@/server/services/results";
import { listOverdueStudents } from "@/server/services/fees";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { Badge } from "@/components/ui";
import { ReleaseBadge, StatusBadge } from "@/components/badges";
import { formatDateTime } from "@/lib/format";
import { ReleaseControls } from "../students/[id]/release-controls";
import { requirePagePermission } from "@/server/session";

export const metadata: Metadata = { title: "Results release" };
export const dynamic = "force-dynamic";

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requirePagePermission("results.release");
  const { filter } = await searchParams;
  const [all, overdue] = await Promise.all([listReleaseOverview(), listOverdueStudents()]);
  const overdueIds = new Set(overdue.map((o) => o.id));
  const rows = filter === "awaiting" ? all.filter((r) => r.awaitingRelease) : all.filter((r) => r.gradeCount > 0);

  return (
    <>
      <PageHeader
        title="Results release"
        subtitle="Publish or withhold each student's marksheet. Students only see marks after publication."
        actions={
          <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1 text-sm">
            <Link href="/staff/results" className={`rounded px-3 py-1 ${filter !== "awaiting" ? "bg-slate-100 font-medium" : "text-slate-600"}`}>All graded</Link>
            <Link href="/staff/results?filter=awaiting" className={`rounded px-3 py-1 ${filter === "awaiting" ? "bg-slate-100 font-medium" : "text-slate-600"}`}>Awaiting release</Link>
          </div>
        }
      />
      <Card padded={false}>
        {rows.length === 0 ? (
          <div className="p-6"><EmptyState title={filter === "awaiting" ? "Nothing awaiting release" : "No students have grades yet"} /></div>
        ) : (
          <table className="data">
            <thead><tr><th>Student</th><th>Grades</th><th>Release</th><th className="w-[28rem]">Action</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/staff/students/${r.id}#results`} className="link">{r.fullName}</Link>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono">{r.studentNumber}</span> · {r.programme.code} <StatusBadge status={r.status} />
                      {overdueIds.has(r.id) && <Badge tone="red">Fees overdue</Badge>}
                    </div>
                  </td>
                  <td className="tabular-nums">{r.gradeCount}</td>
                  <td>
                    <ReleaseBadge status={r.releaseStatus} />
                    {r.publishedAt && r.releaseStatus === "PUBLISHED" && <div className="mt-1 text-xs text-slate-500">{formatDateTime(r.publishedAt)}</div>}
                  </td>
                  <td>
                    <ReleaseControls
                      studentId={r.id}
                      status={r.releaseStatus}
                      reason={r.reason}
                      publishedAt={r.publishedAt?.toISOString() ?? null}
                      gradeCount={r.gradeCount}
                      isOverdue={overdueIds.has(r.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
