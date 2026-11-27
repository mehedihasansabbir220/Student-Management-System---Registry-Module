import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { currentStudentOrRedirect } from "@/server/current-student";
import { getAccount } from "@/server/services/fees";
import { formatGBP } from "@/domain/money";
import { formatDate } from "@/lib/format";
import { buildStatement } from "@/lib/statement";
import { cn } from "@/lib/utils";
import { AccountBadge } from "@/components/badges";
import { EmptyState, Notice, PageHeader, StatCard } from "@/components/common";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Fees" };
export const dynamic = "force-dynamic";

const th = "h-10 text-xs font-medium text-muted-foreground";
const balanceLabel = (pence: number) => (pence < 0 ? `${formatGBP(-pence)} credit` : formatGBP(pence));

export default async function MyFees() {
  const user = await currentStudentOrRedirect();
  const { fees, payments, account: a } = await getAccount(user.studentId);
  const statement = buildStatement(fees, payments);

  return (
    <>
      <PageHeader title="Fees" subtitle="What you owe and what you have paid." actions={<AccountBadge state={a.state} daysOverdue={a.daysOverdue} creditPence={a.creditPence} />} />
      {a.isOverdue && (
        <Notice tone="red" className="mb-4">
          {formatGBP(a.overduePence)} has been overdue since {formatDate(a.oldestOverdueDueDate)}. Overdue fees can delay the release of your results, so please contact the Finance office.
        </Notice>
      )}
      {a.creditPence > 0 && (
        <Notice tone="blue" className="mb-4">You have {formatGBP(a.creditPence)} in credit from an overpayment. The Finance office can refund it or carry it forward.</Notice>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total fees" value={formatGBP(a.billedPence)} />
        <StatCard label="Paid" value={formatGBP(a.paidPence)} tone="green" />
        <StatCard label={a.creditPence ? "Credit" : "Outstanding"} value={formatGBP(a.creditPence || a.balancePence)} tone={a.isOverdue ? "red" : undefined} />
      </div>

      <Card className="mt-6 gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Statement</CardTitle>
          <CardDescription>Charges by due date and payments by the date we received them.</CardDescription>
        </CardHeader>
        {statement.length === 0 ? (
          <div className="p-6"><EmptyState title="Nothing on your account yet" icon={Receipt} /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={th}>Date</TableHead>
                <TableHead className={th}>Description</TableHead>
                <TableHead className={cn(th, "text-right")}>Charge</TableHead>
                <TableHead className={cn(th, "text-right")}>Payment</TableHead>
                <TableHead className={cn(th, "text-right")}>Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statement.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{formatDate(r.date)}</TableCell>
                  <TableCell className={r.kind === "payment" ? "font-mono text-xs" : undefined}>{r.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.chargePence ? formatGBP(r.chargePence) : ""}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">{r.paymentPence ? formatGBP(r.paymentPence) : ""}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{balanceLabel(r.balancePence)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
