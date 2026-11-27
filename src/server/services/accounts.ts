import "server-only";
import type { Prisma } from "@prisma/client";
import { computeAccount, type Account } from "@/domain/fees";
import { toPence } from "@/domain/money";

type FeeRow = { amount: Prisma.Decimal; dueDate: Date };
type PaymentRow = { amount: Prisma.Decimal; voidedAt: Date | null };

/** Boundary between Prisma Decimals and the pure, pence-based domain calculation. */
export function accountFor(fees: FeeRow[], payments: PaymentRow[], today: Date): Account {
  return computeAccount({
    fees: fees.map((f) => ({ amountPence: toPence(f.amount), dueDate: f.dueDate })),
    payments: payments.map((p) => ({ amountPence: toPence(p.amount), voided: p.voidedAt !== null })),
    today,
  });
}

export const accountSelect = {
  fees: { select: { amount: true, dueDate: true } },
  payments: { select: { amount: true, voidedAt: true } },
} as const;
