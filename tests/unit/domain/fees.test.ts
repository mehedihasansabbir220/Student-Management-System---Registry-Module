import { describe, expect, it } from "vitest";
import { computeAccount } from "@/domain/fees";

const today = new Date("2026-03-15T10:00:00Z");
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("computeAccount", () => {
  it("is outstanding but not overdue when nothing is paid and the due date is in the future", () => {
    const a = computeAccount({ fees: [{ amountPence: 900000, dueDate: d("2026-04-01") }], payments: [], today });
    expect(a).toMatchObject({ billedPence: 900000, paidPence: 0, balancePence: 900000, overduePence: 0, isOverdue: false, state: "OUTSTANDING" });
  });

  it("is overdue when a fee's due date has passed with money still owing", () => {
    const a = computeAccount({
      fees: [{ amountPence: 900000, dueDate: d("2026-03-01") }],
      payments: [{ amountPence: 400000 }],
      today,
    });
    expect(a.balancePence).toBe(500000);
    expect(a.overduePence).toBe(500000);
    expect(a.isOverdue).toBe(true);
    expect(a.daysOverdue).toBe(14);
    expect(a.state).toBe("OVERDUE");
  });

  it("is not overdue on the due date itself — only after it", () => {
    const a = computeAccount({ fees: [{ amountPence: 100, dueDate: d("2026-03-15") }], payments: [], today });
    expect(a.isOverdue).toBe(false);
  });

  it("is paid in full when payments exactly match fees, even after the due date", () => {
    const a = computeAccount({
      fees: [{ amountPence: 900000, dueDate: d("2026-01-01") }],
      payments: [{ amountPence: 900000 }],
      today,
    });
    expect(a).toMatchObject({ balancePence: 0, isOverdue: false, state: "PAID" });
  });

  it("reports overpayment as credit, never as a negative balance", () => {
    const a = computeAccount({
      fees: [{ amountPence: 900000, dueDate: d("2026-01-01") }],
      payments: [{ amountPence: 950000 }],
      today,
    });
    expect(a.balancePence).toBe(0);
    expect(a.creditPence).toBe(50000);
    expect(a.state).toBe("CREDIT");
  });

  it("ignores voided payments", () => {
    const a = computeAccount({
      fees: [{ amountPence: 1000, dueDate: d("2026-01-01") }],
      payments: [{ amountPence: 1000, voided: true }],
      today,
    });
    expect(a.paidPence).toBe(0);
    expect(a.isOverdue).toBe(true);
  });

  it("applies payments to the oldest fee first, so only genuinely late money is overdue", () => {
    const a = computeAccount({
      fees: [
        { amountPence: 50000, dueDate: d("2026-04-30") }, // future resit fee
        { amountPence: 100000, dueDate: d("2026-02-01") }, // past tuition
      ],
      payments: [{ amountPence: 100000 }],
      today,
    });
    expect(a.balancePence).toBe(50000);
    expect(a.overduePence).toBe(0);
    expect(a.isOverdue).toBe(false);
  });

  it("measures days overdue from the oldest unpaid due date", () => {
    const a = computeAccount({
      fees: [
        { amountPence: 100, dueDate: d("2026-03-10") },
        { amountPence: 100, dueDate: d("2026-02-13") },
      ],
      payments: [],
      today,
    });
    expect(a.daysOverdue).toBe(30);
    expect(a.overduePence).toBe(200);
  });

  it("handles a student with no fees", () => {
    const a = computeAccount({ fees: [], payments: [], today });
    expect(a).toMatchObject({ billedPence: 0, balancePence: 0, state: "PAID", isOverdue: false, daysOverdue: 0 });
  });
});
