import Link from "next/link";
import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { listReleaseOverview } from "@/server/services/results";
import { listOverdueStudents } from "@/server/services/fees";
import { requirePagePermission } from "@/server/session";
import { formatDateTime } from "@/lib/format";
import { filterReleaseRows, parseReleaseFilter } from "@/lib/release-filter";
import { cn } from "@/lib/utils";
import { ReleaseBadge, StatusBadge } from "@/components/badges";
import { EmptyState, PageHeader, ToneBadge } from "@/components/common";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReleaseControls } from "../students/[id]/release-controls";

export const metadata: Metadata = { title: "Results release" };
export const dynamic = "force-dynamic";

const th = "h-10 text-xs font-medium text-muted-foreground";

function FilterTabs({ active, awaiting }: { active: "graded" | "awaiting"; awaiting: number }) {
  const item = (key: "graded" | "awaiting", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={cn("rounded-md px-3 py-1 text-sm transition", active === key ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Filter" className="inline-flex rounded-lg bg-muted p-1">
      {item("graded", "/staff/results", "All graded")}
      {item("awaiting", "/staff/results?filter=awaiting", `Awaiting release${awaiting ? ` (${awaiting})` : ""}`)}
    </nav>
  );
}

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requirePagePermission("results.release");
  const filter = parseReleaseFilter((await searchParams).filter);
  const [all, overdue] = await Promise.all([listReleaseOverview(), listOverdueStudents()]);
  const overdueIds = new Set(overdue.map((o) => o.id));
  const rows = filterReleaseRows(all, filter);

  return (
    <>
      <PageHeader
        title="Results release"
        subtitle="Publish or withhold each student's marksheet. Students only see marks after publication."
        actions={<FilterTabs active={filter} awaiting={all.filter((r) => r.awaitingRelease).length} />}
      />
      <div className="overflow-hidden rounded-lg border bg-card">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title={filter === "awaiting" ? "Nothing awaiting release" : "No students have grades yet"} icon={GraduationCap} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className={th}>Student</TableHead>
                <TableHead className={cn(th, "text-right")}>Grades</TableHead>
                <TableHead className={th}>Release</TableHead>
                <TableHead className={th}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/staff/students/${r.id}?tab=results`} className="font-medium text-primary hover:underline">{r.fullName}</Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-mono">{r.studentNumber}</span> · {r.programme.code} <StatusBadge status={r.status} />
                      {overdueIds.has(r.id) && <ToneBadge tone="red">Fees overdue</ToneBadge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.gradeCount}</TableCell>
                  <TableCell>
                    <ReleaseBadge status={r.releaseStatus} />
                    {r.releaseStatus === "PUBLISHED" && r.publishedAt && <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(r.publishedAt)}</div>}
                    {r.releaseStatus === "WITHHELD" && r.reason && <div className="mt-1 max-w-56 truncate text-xs text-muted-foreground" title={r.reason}>{r.reason}</div>}
                  </TableCell>
                  <TableCell>
                    <ReleaseControls
                      compact
                      studentId={r.id}
                      studentName={r.fullName}
                      status={r.releaseStatus}
                      reason={r.reason}
                      publishedAt={r.publishedAt?.toISOString() ?? null}
                      gradeCount={r.gradeCount}
                      isOverdue={overdueIds.has(r.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
