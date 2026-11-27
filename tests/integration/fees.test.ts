import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { addFee, getAccount, listOverdueStudents, recordPayment, voidPayment } from "@/server/services/fees";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/server/errors";
import { STAFF, makeProgramme, makeStudent } from "../support/factories";

const today = new Date("2026-03-15T12:00:00Z");

async function studentOwing(amount = "1000.00", dueDate = "2026-03-01", status?: "WITHDRAWN") {
  const p = await makeProgramme();
  const s = await makeStudent(p.id, status ? { status } : {});
  await db.fee.create({ data: { studentId: s.id, description: "Tuition", amount, dueDate: new Date(dueDate), academicYear: "2025/26" } });
  return s;
}

const payment = (reference: string, amount = "250.00") => ({
  amount,
  paidOn: new Date("2026-03-10T00:00:00Z"),
  reference,
  method: "BANK_TRANSFER" as const,
});

describe("recordPayment", () => {
  it("reduces the outstanding balance immediately", async () => {
    const s = await studentOwing();
    const { account } = await recordPayment(s.id, payment("BACS-1"), STAFF, today);
    expect(account.balancePence).toBe(75000);
    expect((await getAccount(s.id, today)).account.balancePence).toBe(75000);
  });

  it("rejects a duplicate reference so a payment cannot be keyed twice", async () => {
    const s = await studentOwing();
    await recordPayment(s.id, payment("BACS-1"), STAFF, today);
    const err = await recordPayment(s.id, payment("BACS-1"), STAFF, today).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.fields).toHaveProperty("reference");
    expect((await getAccount(s.id, today)).account.paidPence).toBe(25000);
  });

  it("accepts overpayment and reports it as credit", async () => {
    const s = await studentOwing("100.00");
    const { account } = await recordPayment(s.id, payment("BACS-1", "150.00"), STAFF, today);
    expect(account).toMatchObject({ balancePence: 0, creditPence: 5000, state: "CREDIT" });
  });

  it("audits the payment", async () => {
    const s = await studentOwing();
    await recordPayment(s.id, payment("BACS-1"), STAFF, today);
    const log = await db.auditLog.findFirstOrThrow({ where: { studentId: s.id, action: "payment.recorded" } });
    expect(log.details).toMatchObject({ amount: "250.00", reference: "BACS-1" });
  });

  it("throws NotFoundError for an unknown student", async () => {
    await expect(recordPayment("nope", payment("X"), STAFF, today)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("voidPayment", () => {
  it("removes the payment from the balance but keeps the record", async () => {
    const s = await studentOwing();
    const { payment: p } = await recordPayment(s.id, payment("BACS-1"), STAFF, today);
    await voidPayment(p.id, "Bounced cheque", STAFF);
    const { account } = await getAccount(s.id, today);
    expect(account.paidPence).toBe(0);
    expect(await db.payment.count({ where: { studentId: s.id } })).toBe(1);
  });

  it("cannot void the same payment twice", async () => {
    const s = await studentOwing();
    const { payment: p } = await recordPayment(s.id, payment("BACS-1"), STAFF, today);
    await voidPayment(p.id, "Bounced", STAFF);
    await expect(voidPayment(p.id, "Again", STAFF)).rejects.toBeInstanceOf(BusinessRuleError);
  });
});

describe("addFee", () => {
  it("adds an extra charge to the student's account", async () => {
    const s = await studentOwing("1000.00", "2026-04-30");
    await addFee(s.id, { description: "Resit fee", amount: "150.00", dueDate: new Date("2026-05-01") }, STAFF, today);
    expect((await getAccount(s.id, today)).account.billedPence).toBe(115000);
  });
});

describe("listOverdueStudents", () => {
  it("lists only students with overdue money, largest amount first", async () => {
    const small = await studentOwing("100.00");
    const big = await studentOwing("5000.00");
    await studentOwing("9999.00", "2026-06-01"); // not yet due
    const paid = await studentOwing("300.00");
    await recordPayment(paid.id, payment("FULL", "300.00"), STAFF, today);

    const list = await listOverdueStudents(today);
    expect(list.map((r) => r.id)).toEqual([big.id, small.id]);
    expect(list[0]).toMatchObject({ overduePence: 500000, daysOverdue: 14 });
  });

  it("still flags withdrawn students — the debt is still owed", async () => {
    const s = await studentOwing("100.00", "2026-03-01", "WITHDRAWN");
    expect((await listOverdueStudents(today)).map((r) => r.id)).toContain(s.id);
  });
});
