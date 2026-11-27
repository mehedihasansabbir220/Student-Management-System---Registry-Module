import Link from "next/link";
import type { Metadata } from "next";
import { listProgrammes, listStudents } from "@/server/services/students";
import { studentListQuerySchema } from "@/lib/validation";
import { Card, EmptyState, Notice, PageHeader } from "@/components/ui";
import { AccountBadge, StatusBadge } from "@/components/badges";
import { formatGBP } from "@/domain/money";
import { STATUS_LABEL } from "@/lib/format";

export const metadata: Metadata = { title: "Students" };
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = studentListQuerySchema.safeParse(raw);
  // Bad query string (e.g. hand-edited URL) → fall back to defaults with a notice, never a 500.
  const query = parsed.success ? parsed.data : studentListQuerySchema.parse({});
  const [result, programmes] = await Promise.all([listStudents(query), listProgrammes()]);
  const hasFilters = Boolean(query.q || query.programmeId || query.status);

  const pageHref = (page: number) => {
    const p = new URLSearchParams(Object.entries({ ...raw, page: String(page) }).filter(([, v]) => v) as [string, string][]);
    return `/staff/students?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${result.total} student${result.total === 1 ? "" : "s"}${hasFilters ? " match your filters" : " on record"}`}
        actions={<Link href="/staff/students/new" className="btn btn-primary">+ Enrol student</Link>}
      />

      {!parsed.success && <div className="mb-4"><Notice>Some filters in the link were invalid and have been ignored.</Notice></div>}

      <form className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_200px_160px_auto]" role="search">
        <input name="q" defaultValue={query.q} placeholder="Search name, Student ID or email…" className="input" aria-label="Search" />
        <select name="programmeId" defaultValue={query.programmeId ?? ""} className="input" aria-label="Programme">
          <option value="">All programmes</option>
          {programmes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
        <select name="status" defaultValue={query.status ?? ""} className="input" aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="btn btn-primary">Filter</button>
          {hasFilters && <Link href="/staff/students" className="btn btn-secondary">Clear</Link>}
        </div>
      </form>

      <Card padded={false}>
        {result.items.length === 0 ? (
          <div className="p-6">
            <EmptyState title={hasFilters ? "No students match your filters" : "No students yet"}>
              {hasFilters ? <Link href="/staff/students" className="link">Clear filters</Link> : <Link href="/staff/students/new" className="link">Enrol the first student</Link>}
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr><th>Student ID</th><th>Name</th><th>Programme</th><th>Year</th><th>Status</th><th className="text-right">Balance</th><th>Fees</th></tr>
              </thead>
              <tbody>
                {result.items.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs text-slate-600">{s.studentNumber}</td>
                    <td>
                      <Link href={`/staff/students/${s.id}`} className="link">{s.fullName}</Link>
                      <div className="text-xs text-slate-500">{s.email}</div>
                    </td>
                    <td className="text-slate-600" title={s.programme.name}>{s.programme.code}</td>
                    <td className="text-slate-600">{s.academicYear}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className={`text-right tabular-nums ${s.account.isOverdue ? "font-semibold text-rose-600" : ""}`}>{formatGBP(s.account.balancePence)}</td>
                    <td><AccountBadge state={s.account.state} daysOverdue={s.account.daysOverdue} creditPence={s.account.creditPence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {result.pageCount > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-slate-500">Page {result.page} of {result.pageCount}</span>
          <div className="flex gap-2">
            {result.page > 1 && <Link className="btn btn-secondary btn-sm" href={pageHref(result.page - 1)}>← Previous</Link>}
            {result.page < result.pageCount && <Link className="btn btn-secondary btn-sm" href={pageHref(result.page + 1)}>Next →</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
