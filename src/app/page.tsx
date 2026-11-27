import { db } from "@/server/db";
import { Card } from "@/components/ui";
import { RolePicker } from "./role-picker";

export const dynamic = "force-dynamic";

export default async function Home() {
  const students = await db.student.findMany({
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, studentNumber: true, status: true, programme: { select: { code: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Student Management System</h1>
        <p className="mt-2 text-slate-500">Registry module — enrolment, fees, submissions and results.</p>
      </div>
      <Card title="Choose how to view the system">
        <p className="mb-4 text-sm text-slate-600">
          Authentication is simulated for this demo. Pick <strong>Registry staff</strong> to manage records, or pick a student to see exactly
          what they would see.
        </p>
        <RolePicker students={students.map((s) => ({ ...s, programme: s.programme.code }))} />
      </Card>
    </div>
  );
}
