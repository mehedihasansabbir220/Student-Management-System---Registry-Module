import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { runSeed } from "../../prisma/seed-data";
import { getDashboard } from "@/server/services/dashboard";
import { getStudentResults } from "@/server/services/results";

const today = new Date("2026-03-15T12:00:00Z");

describe("seed", () => {
  it("meets the brief's minimum: ≥5 students, ≥2 programmes, fees and grades", async () => {
    await runSeed(db, today);
    expect(await db.student.count()).toBeGreaterThanOrEqual(5);
    expect(await db.programme.count()).toBeGreaterThanOrEqual(2);
    expect(await db.fee.count()).toBeGreaterThanOrEqual(5);
    expect(await db.grade.count()).toBeGreaterThan(0);
  });

  it("covers every enrolment status", async () => {
    await runSeed(db, today);
    const statuses = (await db.student.groupBy({ by: ["status"] })).map((g) => g.status).sort();
    expect(statuses).toEqual(["COMPLETED", "DEFERRED", "ENROLLED", "WITHDRAWN"]);
  });

  it("produces the edge cases reviewers should see on the dashboard", async () => {
    await runSeed(db, today);
    const d = await getDashboard(today);
    expect(d.overdue.length).toBeGreaterThanOrEqual(2);
    expect(d.lateSubmissions.length).toBeGreaterThanOrEqual(1);
    expect(d.awaitingRelease.length).toBeGreaterThanOrEqual(1);
    expect(d.upcomingDeadlines.length).toBeGreaterThanOrEqual(1);
    expect(d.finance.creditPence).toBeGreaterThan(0);
  });

  it("has at least one published and one withheld student", async () => {
    await runSeed(db, today);
    const releases = await db.resultRelease.findMany();
    const results = await Promise.all(releases.map((r) => getStudentResults(r.studentId)));
    expect(results.some((r) => r.status === "PUBLISHED")).toBe(true);
    expect(results.some((r) => r.status === "WITHHELD")).toBe(true);
  });

  it("includes a resubmitted (version 2) submission and grades at classification boundaries", async () => {
    await runSeed(db, today);
    expect(await db.submission.count({ where: { version: { gte: 2 } } })).toBeGreaterThanOrEqual(1);
    const marks = (await db.grade.findMany()).map((g) => Number(g.mark));
    for (const boundary of [40, 60, 70]) expect(marks).toContain(boundary);
    expect(marks.some((m) => m < 40)).toBe(true);
  });

  it("is idempotent — running twice gives the same data, not duplicates", async () => {
    await runSeed(db, today);
    const first = await db.student.count();
    await runSeed(db, today);
    expect(await db.student.count()).toBe(first);
  });

  it("uses the real Student ID format", async () => {
    await runSeed(db, today);
    const ids = (await db.student.findMany()).map((s) => s.studentNumber);
    for (const id of ids) expect(id).toMatch(/^SMS-\d{4}-\d{4}$/);
  });
});
