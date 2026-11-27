import { describe, expect, it } from "vitest";
import { buildStatement } from "@/lib/statement";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("buildStatement", () => {
  it("lists charges and payments by date with a running balance in pence", () => {
    const rows = buildStatement(
      [{ id: "f1", description: "Tuition", amount: "9250.00", dueDate: d("2025-09-01") }],
      [
        { id: "p2", reference: "B2", amount: "250.50", paidOn: d("2025-10-01"), voidedAt: null },
        { id: "p1", reference: "B1", amount: "1000.00", paidOn: d("2025-08-15"), voidedAt: null },
      ],
    );
    expect(rows.map((r) => [r.id, r.chargePence, r.paymentPence, r.balancePence])).toEqual([
      ["p1", 0, 100000, -100000],
      ["f1", 925000, 0, 825000],
      ["p2", 0, 25050, 799950],
    ]);
  });

  it("leaves voided payments out", () => {
    const rows = buildStatement([], [{ id: "p", reference: "X", amount: "10.00", paidOn: d("2025-01-01"), voidedAt: d("2025-01-02") }]);
    expect(rows).toEqual([]);
  });

  it("puts a charge before a payment on the same day", () => {
    const rows = buildStatement(
      [{ id: "f", description: "Resit", amount: "100.00", dueDate: d("2025-05-01") }],
      [{ id: "p", reference: "R", amount: "100.00", paidOn: d("2025-05-01"), voidedAt: null }],
    );
    expect(rows.map((r) => r.id)).toEqual(["f", "p"]);
    expect(rows.at(-1)!.balancePence).toBe(0);
  });
});
