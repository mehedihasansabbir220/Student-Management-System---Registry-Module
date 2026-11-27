import type { Metadata } from "next";
import { currentStudentOrRedirect } from "@/server/current-student";
import { getAccount } from "@/server/services/fees";
import { Card, EmptyState, Notice, PageHeader, Stat } from "@/components/ui";
import { AccountBadge } from "@/components/badges";
import { formatGBP, toPence } from "@/domain/money";
import { formatDate, METHOD_LABEL } from "@/lib/format";

export const metadata: Metadata = { title: "My fees" };
export const dynamic = "force-dynamic";

export default async function MyFees() {
  const user = await currentStudentOrRedirect();
  const { fees, payments, account: a } = await getAccount(user.studentId);
  const valid = payments.filter((p) => !p.voidedAt);

  return (
    <>
      <PageHeader title="My fees" subtitle="What you owe and what you have paid." actions={<AccountBadge state={a.state} daysOverdue={a.daysOverdue} creditPence={a.creditPence} />} />
      {a.isOverdue && (
        <div className="mb-4">
          <Notice tone="red">
            {formatGBP(a.overduePence)} has been overdue since {formatDate(a.oldestOverdueDueDate)}. Overdue fees can delay the release of your results — please contact the Finance office.
          </Notice>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total fees" value={formatGBP(a.billedPence)} />
        <Stat label="Paid" value={formatGBP(a.paidPence)} tone="green" />
        <Stat label={a.creditPence ? "Credit" : "Outstanding"} value={formatGBP(a.creditPence || a.balancePence)} tone={a.isOverdue ? "red" : undefined} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Charges" padded={false}>
          <table className="data">
            <thead><tr><th>Description</th><th>Due</th><th className="text-right">Amount</th></tr></thead>
            <tbody>{fees.map((f) => <tr key={f.id}><td>{f.description}</td><td>{formatDate(f.dueDate)}</td><td className="text-right tabular-nums">{formatGBP(toPence(f.amount))}</td></tr>)}</tbody>
          </table>
        </Card>
        <Card title="Payments received" padded={false}>
          {valid.length === 0 ? <div className="p-5"><EmptyState title="No payments yet" /></div> : (
            <table className="data">
              <thead><tr><th>Date</th><th>Reference</th><th>Method</th><th className="text-right">Amount</th></tr></thead>
              <tbody>{valid.map((p) => <tr key={p.id}><td>{formatDate(p.paidOn)}</td><td className="font-mono text-xs">{p.reference}</td><td>{METHOD_LABEL[p.method]}</td><td className="text-right tabular-nums">{formatGBP(toPence(p.amount))}</td></tr>)}</tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
