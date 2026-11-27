import { db } from "@/server/db";
import type { EnrolmentStatus } from "@prisma/client";

let counter = 0;
const uniq = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Wipe every table between tests (fast; keeps schema + migrations). */
export async function resetDatabase() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export const STAFF = "staff:test";

export async function makeProgramme(overrides: Partial<{ code: string; name: string; feeAmount: string }> = {}) {
  return db.programme.create({
    data: { code: overrides.code ?? `P-${uniq()}`, name: overrides.name ?? "BSc Test Studies", feeAmount: overrides.feeAmount ?? "9250.00" },
  });
}

export async function makeModule(programmeId: string, overrides: Partial<{ code: string; title: string }> = {}) {
  return db.module.create({
    data: { programmeId, code: overrides.code ?? `M-${uniq()}`, title: overrides.title ?? "Test Module" },
  });
}

/** Inserts a student directly (bypasses the service) — use for fixtures, not for testing enrolment. */
export async function makeStudent(
  programmeId: string,
  overrides: Partial<{ fullName: string; email: string; status: EnrolmentStatus; academicYear: string }> = {},
) {
  const n = ++counter;
  return db.student.create({
    data: {
      studentNumber: `SMS-2099-${String(n).padStart(4, "0")}`,
      fullName: overrides.fullName ?? `Student ${n}`,
      email: overrides.email ?? `student${n}-${uniq()}@example.com`,
      dateOfBirth: new Date("2004-01-01T00:00:00Z"),
      programmeId,
      academicYear: overrides.academicYear ?? "2025/26",
      status: overrides.status ?? "ENROLLED",
      resultRelease: { create: {} },
    },
  });
}

export async function makeAssessment(moduleId: string, deadline: Date, title = "Essay 1") {
  return db.assessment.create({ data: { moduleId, deadline, title } });
}

export const validStudentInput = (programmeId: string, overrides: Record<string, unknown> = {}) => ({
  fullName: "Ada Lovelace",
  email: `ada-${uniq()}@example.com`,
  dateOfBirth: new Date("2004-05-10T00:00:00Z"),
  programmeId,
  academicYear: "2025/26",
  status: "ENROLLED" as const,
  ...overrides,
});
