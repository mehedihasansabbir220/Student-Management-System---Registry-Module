import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { runSeed } from "../../prisma/seed-data";
import { getDashboard } from "@/server/services/dashboard";
import { getStudentResults } from "@/server/services/results";
import { login } from "@/server/services/auth";

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

describe("seeded demo accounts", () => {
  const DEMO = "Demo@12345";
  const signIn = (email: string) => login({ email, password: DEMO }, { now: today });

  it("has one working account per staff role", async () => {
    await runSeed(db, today);
    expect((await signIn("admin@demo.sms")).user.role).toBe("REGISTRY_ADMIN");
    expect((await signIn("finance@demo.sms")).user.role).toBe("FINANCE");
    expect((await signIn("academic@demo.sms")).user.role).toBe("ACADEMIC");
  });

  it("lets seeded students sign in to their portal", async () => {
    await runSeed(db, today);
    const s = await signIn("amelia.clarke@student.example.ac.uk");
    expect(s.user.role).toBe("STUDENT");
    expect(s.user.studentId).toBeTruthy();
  });

  it("leaves James Wilson's invitation pending with a usable activation link", async () => {
    await runSeed(db, today);
    const james = await db.user.findUniqueOrThrow({ where: { email: "james.wilson@student.example.ac.uk" }, include: { activationTokens: true } });
    expect(james.passwordHash).toBeNull();
    const usable = james.activationTokens.filter((t) => !t.usedAt && t.expiresAt > today);
    expect(usable).toHaveLength(1);
  });

  it("marks every seeded account as a protected demo account", async () => {
    await runSeed(db, today);
    expect(await db.user.count({ where: { isDemo: false } })).toBe(0);
  });

  it("leaves no stray activation links on already-active accounts", async () => {
    await runSeed(db, today);
    expect(await db.activationToken.count({ where: { usedAt: null, user: { passwordHash: { not: null } } } })).toBe(0);
  });

  it("is idempotent for users too", async () => {
    await runSeed(db, today);
    await runSeed(db, today);
    expect(await db.user.count({ where: { role: { not: "STUDENT" } } })).toBe(3);
  });
});
