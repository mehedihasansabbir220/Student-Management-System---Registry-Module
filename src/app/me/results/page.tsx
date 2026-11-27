import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { currentStudentOrRedirect } from "@/server/current-student";
import { getStudentResults } from "@/server/services/results";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClassificationBadge } from "@/components/badges";
import { PageHeader } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Results" };
export const dynamic = "force-dynamic";

const th = "h-10 text-xs font-medium text-muted-foreground";

export default async function MyResults() {
  const user = await currentStudentOrRedirect();
  // Server-side filtered: when withheld, no marks are ever sent to the browser.
  const r = await getStudentResults(user.studentId);

  if (r.status === "WITHHELD") {
    return (
      <>
        <PageHeader title="Results" />
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <Lock className="size-5" />
            </div>
            <h2 className="text-lg font-semibold">Your results are not available yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {r.reason ? <>The Registry has withheld your results: <strong className="text-foreground">{r.reason}</strong>.</> : "Your results are not available yet. Please contact the Registry office if you have questions."}
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Results"
        subtitle={`${user.name} · ${user.studentNumber}${r.publishedAt ? ` · published ${formatDateTime(r.publishedAt)}` : ""}`}
        actions={<PrintButton />}
      />
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className={th}>Module</TableHead>
              <TableHead className={th}>Assessment</TableHead>
              <TableHead className={cn(th, "text-right")}>Mark</TableHead>
              <TableHead className={th}>Classification</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.grades.map((g) => (
              <TableRow key={g.id}>
                <TableCell><span className="font-medium">{g.moduleCode}</span> <span className="text-muted-foreground">{g.moduleTitle}</span></TableCell>
                <TableCell>{g.assessmentTitle}</TableCell>
                <TableCell className="text-right text-base font-semibold tabular-nums">{g.mark}</TableCell>
                <TableCell><ClassificationBadge value={g.classification} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
          {r.average !== null && r.overall && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="text-right text-sm font-medium text-muted-foreground">Average</TableCell>
                <TableCell className="text-right text-base font-semibold tabular-nums">{r.average}</TableCell>
                <TableCell><ClassificationBadge value={r.overall} /></TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Pass ≥ 40 · Merit ≥ 60 · Distinction ≥ 70</p>
    </>
  );
}
