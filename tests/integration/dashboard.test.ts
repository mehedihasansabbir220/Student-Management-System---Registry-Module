import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getDashboard } from "@/server/services/dashboard";
import { submitAssessment } from "@/server/services/submissions";
import { enterGrade } from "@/server/services/results";
import { STAFF, makeAssessment, makeModule, makeProgramme, makeStudent } from "../support/factories";

const today = new Date("2026-03-15T12:00:00Z");
const pdf = new TextEncoder().encode("%PDF-1.7 x");

async function fee(studentId: string, amount: string, due: string) {
  await db.fee.create({ data: { studentId, description: "Tuition", amount, dueDate: new Date(due), academicYear: "2025/26" } });
}

describe("getDashboard", () => {
  it("counts students by enrolment status", async () => {
    const p = await makeProgramme();
    await makeStudent(p.id);
    await makeStudent(p.id);
    await makeStudent(p.id, { status: "DEFERRED" });
    const d = await getDashboard(today);
    expect(d.statusCounts).toEqual({ ENROLLED: 2, DEFERRED: 1, WITHDRAWN: 0, COMPLETED: 0 });
  });

  it("flags overdue balances and summarises finance", async () => {
    const p = await makeProgramme();
    const overdue = await makeStudent(p.id);
    const fine = await makeStudent(p.id);
    await fee(overdue.id, "1000.00", "2026-03-01");
    await fee(fine.id, "500.00", "2026-04-01");
    await db.payment.create({ data: { studentId: fine.id, amount: "600.00", paidOn: new Date("2026-03-01"), reference: "P1" } });

    const d = await getDashboard(today);
    expect(d.overdue.map((o) => o.id)).toEqual([overdue.id]);
    expect(d.overdueTotalPence).toBe(100000);
    expect(d.finance).toEqual({ billedPence: 150000, collectedPence: 60000, outstandingPence: 100000, creditPence: 10000 });
  });

  it("lists assessments due in the next 7 days with missing counts", async () => {
    const p = await makeProgramme();
    const m = await makeModule(p.id);
    const soon = await makeAssessment(m.id, new Date("2026-03-18T17:00:00Z"), "Soon");
    await makeAssessment(m.id, new Date("2026-04-30T17:00:00Z"), "Later");
    await makeAssessment(m.id, new Date("2026-03-10T17:00:00Z"), "Past");
    await makeStudent(p.id);
    const d = await getDashboard(today);
    expect(d.upcomingDeadlines.map((a) => [a.id, a.counts.missing])).toEqual([[soon.id, 1]]);
  });

  it("shows recent late submissions and results awaiting release", async () => {
    const p = await makeProgramme();
    const m = await makeModule(p.id);
    const a = await makeAssessment(m.id, new Date("2026-03-10T17:00:00Z"));
    const s = await makeStudent(p.id);
    await submitAssessment({ assessmentId: a.id, studentId: s.id, fileName: "x.pdf", bytes: pdf, now: new Date("2026-03-11T09:00:00Z"), actor: "t" });
    await enterGrade({ assessmentId: a.id, studentId: s.id, mark: 50 }, STAFF);

    const d = await getDashboard(today);
    expect(d.lateSubmissions.map((l) => l.student.id)).toEqual([s.id]);
    expect(d.awaitingRelease.map((r) => r.id)).toEqual([s.id]);
  });
});
