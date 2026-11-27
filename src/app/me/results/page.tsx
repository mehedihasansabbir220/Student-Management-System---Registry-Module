import type { Metadata } from "next";
import { currentStudentOrRedirect } from "@/server/current-student";
import { getStudentResults } from "@/server/services/results";
import { Card, PageHeader } from "@/components/ui";
import { ClassificationBadge } from "@/components/badges";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "My results" };
export const dynamic = "force-dynamic";

export default async function MyResults() {
  const user = await currentStudentOrRedirect();
  // Server-side filtered: when withheld, no marks are ever sent to the browser.
  const r = await getStudentResults(user.studentId);

  if (r.status === "WITHHELD") {
    return (
      <>
        <PageHeader title="My results" />
        <Card>
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-xl">🔒</div>
            <h2 className="text-lg font-semibold">Your results are not available yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              {r.reason ? <>The Registry has withheld your results: <strong className="text-slate-700">{r.reason}</strong>.</> : "Your marks will appear here once the Registry has published them."}
            </p>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="My results" subtitle={r.publishedAt ? `Published ${formatDateTime(r.publishedAt)}` : undefined} />
      <Card padded={false}>
        <table className="data">
          <thead><tr><th>Module</th><th>Assessment</th><th className="text-right">Mark</th><th>Classification</th></tr></thead>
          <tbody>
            {r.grades.map((g) => (
              <tr key={g.id}>
                <td><span className="font-medium">{g.moduleCode}</span> <span className="text-slate-500">{g.moduleTitle}</span></td>
                <td>{g.assessmentTitle}</td>
                <td className="text-right text-base font-semibold tabular-nums">{g.mark}</td>
                <td><ClassificationBadge value={g.classification} /></td>
              </tr>
            ))}
          </tbody>
          {r.average !== null && r.overall && (
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={2} className="px-4 py-3 text-right text-sm font-medium text-slate-600">Average</td>
                <td className="px-4 py-3 text-right text-base font-semibold tabular-nums">{r.average}</td>
                <td className="px-4 py-3"><ClassificationBadge value={r.overall} /></td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
      <p className="mt-3 text-xs text-slate-500">Pass ≥ 40 · Merit ≥ 60 · Distinction ≥ 70</p>
    </>
  );
}
