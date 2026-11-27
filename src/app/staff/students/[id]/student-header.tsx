import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AccountBadge, StatusBadge } from "@/components/badges";
import type { Account } from "@/domain/fees";
import { initials } from "@/lib/initials";
import type { STATUS_LABEL } from "@/lib/format";
import { PortalAccountBadge, type PortalStatus } from "./portal-account";

export function StudentHeader({
  fullName,
  studentNumber,
  status,
  programme,
  academicYear,
  account,
  portalStatus,
}: {
  fullName: string;
  studentNumber: string;
  status: keyof typeof STATUS_LABEL;
  programme: string;
  academicYear: string;
  /** Only passed for roles with finance.read. */
  account: Account | null;
  portalStatus: PortalStatus;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start gap-4">
      <Avatar className="size-14">
        <AvatarFallback className="bg-accent text-lg font-semibold text-accent-foreground">{initials(fullName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          <span className="font-mono">{studentNumber}</span> · {programme} · {academicYear}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={status} />
          {account && <AccountBadge state={account.state} daysOverdue={account.daysOverdue} creditPence={account.creditPence} />}
          <PortalAccountBadge status={portalStatus} />
        </div>
      </div>
    </div>
  );
}
