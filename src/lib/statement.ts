import { toPence } from "@/domain/money";

type Money = string | number | { toString(): string };
export type StatementRow = { id: string; date: Date; kind: "charge" | "payment"; description: string; chargePence: number; paymentPence: number; balancePence: number };

/**
 * A student's statement: charges (by due date) and valid payments (by date
 * received) in date order, with the balance after each line. Negative = credit.
 * Voided payments are not part of the account, so they are left out.
 */
export function buildStatement(
  fees: { id: string; description: string; amount: Money; dueDate: Date }[],
  payments: { id: string; reference: string; amount: Money; paidOn: Date; voidedAt: Date | null }[],
): StatementRow[] {
  const lines = [
    ...fees.map((f) => ({ id: f.id, date: f.dueDate, kind: "charge" as const, description: f.description, chargePence: toPence(f.amount), paymentPence: 0 })),
    ...payments.filter((p) => !p.voidedAt).map((p) => ({ id: p.id, date: p.paidOn, kind: "payment" as const, description: `Payment ${p.reference}`, chargePence: 0, paymentPence: toPence(p.amount) })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime() || (a.kind === b.kind ? 0 : a.kind === "charge" ? -1 : 1));

  let balance = 0;
  return lines.map((l) => {
    balance += l.chargePence - l.paymentPence;
    return { ...l, balancePence: balance };
  });
}
