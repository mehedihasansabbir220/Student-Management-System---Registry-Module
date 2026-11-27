/**
 * Student account calculation. Balance is never stored — it is always derived
 * from fees and (non-voided) payments, so it is "real time" by construction.
 *
 * Payments are allocated to the oldest fee first (FIFO by due date). That way
 * a student who has paid last term's tuition but not a resit fee due next
 * month is NOT shown as overdue.
 */

export type FeeInput = { amountPence: number; dueDate: Date };
export type PaymentInput = { amountPence: number; voided?: boolean };

export type AccountState = "PAID" | "CREDIT" | "OUTSTANDING" | "OVERDUE";

export type Account = {
  billedPence: number;
  paidPence: number;
  balancePence: number;
  creditPence: number;
  overduePence: number;
  isOverdue: boolean;
  daysOverdue: number;
  oldestOverdueDueDate: Date | null;
  state: AccountState;
};

const DAY_MS = 86_400_000;
const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export function computeAccount(input: { fees: FeeInput[]; payments: PaymentInput[]; today: Date }): Account {
  const billedPence = input.fees.reduce((s, f) => s + f.amountPence, 0);
  const paidPence = input.payments.filter((p) => !p.voided).reduce((s, p) => s + p.amountPence, 0);
  const net = billedPence - paidPence;
  const balancePence = Math.max(net, 0);
  const creditPence = Math.max(-net, 0);

  const todayDay = utcDay(input.today);
  let remaining = paidPence;
  let overduePence = 0;
  let oldestOverdueDueDate: Date | null = null;

  const sorted = [...input.fees].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  for (const fee of sorted) {
    const applied = Math.min(remaining, fee.amountPence);
    remaining -= applied;
    const unpaid = fee.amountPence - applied;
    if (unpaid > 0 && utcDay(fee.dueDate) < todayDay) {
      overduePence += unpaid;
      oldestOverdueDueDate ??= fee.dueDate;
    }
  }

  const isOverdue = overduePence > 0;
  const daysOverdue = oldestOverdueDueDate ? Math.round((todayDay - utcDay(oldestOverdueDueDate)) / DAY_MS) : 0;
  const state: AccountState = isOverdue ? "OVERDUE" : balancePence > 0 ? "OUTSTANDING" : creditPence > 0 ? "CREDIT" : "PAID";

  return { billedPence, paidPence, balancePence, creditPence, overduePence, isOverdue, daysOverdue, oldestOverdueDueDate, state };
}
