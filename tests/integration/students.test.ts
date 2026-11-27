import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createStudent, getStudent, listStudents, updateStudent } from "@/server/services/students";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { activate } from "@/server/services/auth";
import { STAFF, makeProgramme, makeStudent, makeUser, validStudentInput } from "../support/factories";

const today = new Date("2025-09-20T09:00:00Z");

describe("createStudent", () => {
  it("generates sequential Student IDs per intake year", async () => {
    const p = await makeProgramme();
    const a = await createStudent(validStudentInput(p.id), STAFF, today);
    const b = await createStudent(validStudentInput(p.id), STAFF, today);
    const c = await createStudent(validStudentInput(p.id, { academicYear: "2026/27" }), STAFF, today);
    expect(a.studentNumber).toBe("SMS-2025-0001");
    expect(b.studentNumber).toBe("SMS-2025-0002");
    expect(c.studentNumber).toBe("SMS-2026-0001");
  });

  it("never hands out the same ID under concurrent enrolment", async () => {
    const p = await makeProgramme();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => createStudent(validStudentInput(p.id), STAFF, today)),
    );
    const ids = results.map((s) => s.studentNumber);
    expect(new Set(ids).size).toBe(10);
    expect(ids.sort()).toEqual(Array.from({ length: 10 }, (_, i) => `SMS-2025-${String(i + 1).padStart(4, "0")}`));
  });

  it("assigns the programme fee as a snapshot, due 30 days after enrolment", async () => {
    const p = await makeProgramme({ feeAmount: "8500.00" });
    const s = await createStudent(validStudentInput(p.id), STAFF, today);
    const fees = await db.fee.findMany({ where: { studentId: s.id } });
    expect(fees).toHaveLength(1);
    expect(fees[0].amount.toString()).toBe("8500");
    expect(fees[0].dueDate.toISOString().slice(0, 10)).toBe("2025-10-20");

    // A later price change must not rewrite what this student owes.
    await db.programme.update({ where: { id: p.id }, data: { feeAmount: "9999.00" } });
    const after = await db.fee.findFirstOrThrow({ where: { studentId: s.id } });
    expect(after.amount.toString()).toBe("8500");
  });

  it("starts every student with results WITHHELD", async () => {
    const p = await makeProgramme();
    const s = await createStudent(validStudentInput(p.id), STAFF, today);
    const release = await db.resultRelease.findUniqueOrThrow({ where: { studentId: s.id } });
    expect(release.status).toBe("WITHHELD");
  });

  it("writes an audit entry", async () => {
    const p = await makeProgramme();
    const s = await createStudent(validStudentInput(p.id), STAFF, today);
    const log = await db.auditLog.findFirstOrThrow({ where: { studentId: s.id } });
    expect(log).toMatchObject({ action: "student.created", actor: STAFF });
  });

  it("rejects a duplicate email with a field-level conflict", async () => {
    const p = await makeProgramme();
    await createStudent(validStudentInput(p.id, { email: "dup@example.com" }), STAFF, today);
    const err = await createStudent(validStudentInput(p.id, { email: "dup@example.com" }), STAFF, today).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.fields).toHaveProperty("email");
  });

  it("does not burn a Student ID when enrolment fails", async () => {
    const p = await makeProgramme();
    await createStudent(validStudentInput(p.id, { email: "dup@example.com" }), STAFF, today);
    await createStudent(validStudentInput(p.id, { email: "dup@example.com" }), STAFF, today).catch(() => undefined);
    const next = await createStudent(validStudentInput(p.id), STAFF, today);
    expect(next.studentNumber).toBe("SMS-2025-0002");
  });

  it("rejects an unknown programme as a validation error on that field", async () => {
    const err = await createStudent(validStudentInput("missing"), STAFF, today).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.fields).toHaveProperty("programmeId");
  });
});

describe("listStudents", () => {
  async function seed() {
    const cs = await makeProgramme({ code: "CS", name: "Computer Science" });
    const bus = await makeProgramme({ code: "BUS", name: "Business" });
    const ada = await makeStudent(cs.id, { fullName: "Ada Lovelace" });
    await makeStudent(cs.id, { fullName: "Alan Turing", status: "DEFERRED" });
    await makeStudent(bus.id, { fullName: "Grace Hopper", status: "WITHDRAWN" });
    return { cs, bus, ada };
  }

  it("searches name case-insensitively and partially", async () => {
    await seed();
    const r = await listStudents({ q: "lovel", page: 1, pageSize: 20 }, today);
    expect(r.items.map((s) => s.fullName)).toEqual(["Ada Lovelace"]);
  });

  it("searches by Student ID", async () => {
    const { ada } = await seed();
    const r = await listStudents({ q: ada.studentNumber.toLowerCase(), page: 1, pageSize: 20 }, today);
    expect(r.items.map((s) => s.id)).toEqual([ada.id]);
  });

  it("combines programme and status filters with AND", async () => {
    const { cs } = await seed();
    const r = await listStudents({ programmeId: cs.id, status: "DEFERRED", page: 1, pageSize: 20 }, today);
    expect(r.items.map((s) => s.fullName)).toEqual(["Alan Turing"]);
  });

  it("paginates and reports the total", async () => {
    await seed();
    const r = await listStudents({ page: 2, pageSize: 2 }, today);
    expect(r.total).toBe(3);
    expect(r.items).toHaveLength(1);
  });

  it("includes each student's balance and overdue flag", async () => {
    const { ada } = await seed();
    await db.fee.create({ data: { studentId: ada.id, description: "Tuition", amount: "1000.00", dueDate: new Date("2025-09-01"), academicYear: "2025/26" } });
    await db.payment.create({ data: { studentId: ada.id, amount: "400.00", paidOn: new Date("2025-08-01"), reference: "R1" } });
    const r = await listStudents({ q: "Ada", page: 1, pageSize: 20 }, today);
    expect(r.items[0].account).toMatchObject({ balancePence: 60000, isOverdue: true });
  });
});

describe("getStudent", () => {
  it("throws NotFoundError for an unknown id", async () => {
    await expect(getStudent("nope", today)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("student accounts", () => {
  it("enrolment creates a pending STUDENT account and an activation token that works", async () => {
    const p = await makeProgramme();
    const s = await createStudent(validStudentInput(p.id, { email: "new.student@example.com" }), STAFF, today);
    const user = await db.user.findUniqueOrThrow({ where: { studentId: s.id } });
    expect(user).toMatchObject({ role: "STUDENT", email: "new.student@example.com", name: "Ada Lovelace", passwordHash: null });
    const session = await activate({ token: s.activationToken, password: "Student-Pass-1" }, { now: today });
    expect(session.user.studentId).toBe(s.id);
  });

  it("getStudent reports the portal account status without exposing secrets", async () => {
    const p = await makeProgramme();
    const s = await createStudent(validStudentInput(p.id), STAFF, today);
    const pending = await getStudent(s.id, today);
    expect(pending.portalAccount).toEqual({ status: "PENDING", lastLoginAt: null });
    expect(JSON.stringify(pending)).not.toMatch(/passwordHash|tokenHash/);
    await activate({ token: s.activationToken, password: "Student-Pass-1" }, { now: today });
    expect((await getStudent(s.id, today)).portalAccount).toEqual({ status: "ACTIVE", lastLoginAt: today });
  });

  it("an email change on the student record is mirrored to their account", async () => {
    const p = await makeProgramme();
    const s = await createStudent(validStudentInput(p.id), STAFF, today);
    await updateStudent(s.id, { email: "changed@example.com" }, STAFF);
    expect((await db.user.findUniqueOrThrow({ where: { studentId: s.id } })).email).toBe("changed@example.com");
  });

  it("refuses an email already used by a staff account", async () => {
    const p = await makeProgramme();
    await makeUser("FINANCE", { email: "finance@example.com" });
    const s = await createStudent(validStudentInput(p.id), STAFF, today);
    const err = await updateStudent(s.id, { email: "finance@example.com" }, STAFF).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.fields).toHaveProperty("email");
  });

  it("refuses to enrol with an email already used by a staff account", async () => {
    const p = await makeProgramme();
    await makeUser("FINANCE", { email: "finance@example.com" });
    const err = await createStudent(validStudentInput(p.id, { email: "finance@example.com" }), STAFF, today).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.fields).toHaveProperty("email");
  });
});

describe("updateStudent", () => {
  it("records status changes in the audit log with from/to", async () => {
    const p = await makeProgramme();
    const s = await makeStudent(p.id);
    await updateStudent(s.id, { status: "WITHDRAWN" }, STAFF);
    const log = await db.auditLog.findFirstOrThrow({ where: { studentId: s.id, action: "student.status_changed" } });
    expect(log.details).toEqual({ from: "ENROLLED", to: "WITHDRAWN" });
  });

  it("keeps outstanding fees when a student withdraws", async () => {
    const p = await makeProgramme();
    const s = await makeStudent(p.id);
    await db.fee.create({ data: { studentId: s.id, description: "Tuition", amount: "500.00", dueDate: new Date("2025-01-01"), academicYear: "2025/26" } });
    await updateStudent(s.id, { status: "WITHDRAWN" }, STAFF);
    expect(await db.fee.count({ where: { studentId: s.id } })).toBe(1);
  });

  it("rejects an email already used by another student", async () => {
    const p = await makeProgramme();
    await makeStudent(p.id, { email: "taken@example.com" });
    const s = await makeStudent(p.id);
    await expect(updateStudent(s.id, { email: "taken@example.com" }, STAFF)).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws NotFoundError for an unknown student", async () => {
    await expect(updateStudent("nope", { status: "DEFERRED" }, STAFF)).rejects.toBeInstanceOf(NotFoundError);
  });
});
