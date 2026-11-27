import type { Metadata } from "next";
import { listProgrammes, listStudents } from "@/server/services/students";
import { requirePagePermission } from "@/server/session";
import { can } from "@/domain/permissions";
import { formatGBP, toPence } from "@/domain/money";
import { currentAcademicYear } from "@/lib/academic-year";
import { STATUS_LABEL } from "@/lib/format";
import { parseTableState } from "@/lib/table-state";
import { studentListQuerySchema } from "@/lib/validation";
import { Notice, PageHeader } from "@/components/common";
import { EnrolStudentSheet } from "./enrol-student-sheet";
import { StudentsTable } from "./students-table";

export const metadata: Metadata = { title: "Students" };
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
const FILTER_KEYS = ["q", "programmeId", "status"] as const;

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await requirePagePermission("students.read");
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = studentListQuerySchema.safeParse(raw);
  // Bad query string (e.g. hand-edited URL) → fall back to defaults with a notice, never a 500.
  const query = parsed.success ? parsed.data : studentListQuerySchema.parse({});
  const [result, programmes] = await Promise.all([listStudents(query), listProgrammes()]);
  const state = parsed.success
    ? parseTableState(new URLSearchParams(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string")), { filterKeys: FILTER_KEYS })
    : { page: 1, pageSize: 20, filters: {} };
  const hasFilters = Boolean(query.q || query.programmeId || query.status);
  const canEnrol = can(viewer.role, "students.write");

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${result.total} student${result.total === 1 ? "" : "s"}${hasFilters ? " match your filters" : " on record"}`}
        actions={
          canEnrol ? (
            <EnrolStudentSheet
              openOnLoad={raw.enrol === "1"}
              defaultAcademicYear={currentAcademicYear()}
              programmes={programmes.map((p) => ({ id: p.id, label: `${p.code} — ${p.name}`, fee: formatGBP(toPence(p.feeAmount)) }))}
            />
          ) : undefined
        }
      />

      {!parsed.success && <Notice className="mb-4">Some filters in the link were invalid and have been ignored.</Notice>}

      <StudentsTable
        state={state}
        total={result.total}
        pageCount={result.pageCount}
        rows={result.items.map((s) => ({
          id: s.id,
          studentNumber: s.studentNumber,
          fullName: s.fullName,
          email: s.email,
          academicYear: s.academicYear,
          status: s.status,
          programme: { code: s.programme.code, name: s.programme.name },
          // Finance figures only reach the browser for roles allowed to see them.
          account: can(viewer.role, "finance.read") ? s.account : null,
        }))}
        showFinance={can(viewer.role, "finance.read")}
        canEnrol={canEnrol}
        hasFilters={hasFilters}
        programmes={programmes.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
        statuses={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
      />
    </>
  );
}
