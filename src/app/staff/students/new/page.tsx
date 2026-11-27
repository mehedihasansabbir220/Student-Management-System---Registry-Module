import type { Metadata } from "next";
import { listProgrammes } from "@/server/services/students";
import { Card, PageHeader } from "@/components/ui";
import { formatGBP, toPence } from "@/domain/money";
import { StudentForm } from "./student-form";

export const metadata: Metadata = { title: "Enrol student" };
export const dynamic = "force-dynamic";

/** Academic year that is "current" for a UK institution: starts in September. */
function currentAcademicYear(now = new Date()) {
  const start = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

export default async function NewStudentPage() {
  const programmes = await listProgrammes();
  return (
    <>
      <PageHeader title="Enrol a student" subtitle="A Student ID is generated automatically and the programme fee is assigned." back={{ href: "/staff/students", label: "Students" }} />
      <Card className="max-w-2xl">
        <StudentForm
          defaultAcademicYear={currentAcademicYear()}
          programmes={programmes.map((p) => ({ id: p.id, label: `${p.code} — ${p.name}`, fee: formatGBP(toPence(p.feeAmount)) }))}
        />
      </Card>
    </>
  );
}
