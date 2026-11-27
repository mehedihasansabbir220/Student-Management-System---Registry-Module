"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import type { Account } from "@/domain/fees";
import { formatGBP } from "@/domain/money";
import type { TableState } from "@/lib/table-state";
import type { STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AccountBadge, StatusBadge } from "@/components/badges";
import { EmptyState } from "@/components/common";
import { ColumnHeader } from "@/components/data-table/column-header";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { FacetedFilter } from "@/components/data-table/faceted-filter";
import { SearchInput } from "@/components/data-table/search-input";
import { TableNavProvider, useTableNav } from "@/components/data-table/table-nav";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type StudentRow = {
  id: string;
  studentNumber: string;
  fullName: string;
  email: string;
  academicYear: string;
  status: keyof typeof STATUS_LABEL;
  programme: { code: string; name: string };
  account: Account | null;
};

type Option = { value: string; label: string };

function columns(showFinance: boolean): DataTableColumn<StudentRow>[] {
  const cols: DataTableColumn<StudentRow>[] = [
    {
      id: "studentNumber",
      header: () => <ColumnHeader title="Student ID" sortKey="studentNumber" />,
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.studentNumber}</span>,
      meta: { label: "Student ID", hideable: false },
    },
    {
      id: "name",
      header: () => <ColumnHeader title="Name" sortKey="name" />,
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link href={`/staff/students/${row.original.id}`} className="font-medium text-primary hover:underline">{row.original.fullName}</Link>
          <div className="truncate text-xs text-muted-foreground">{row.original.email}</div>
        </div>
      ),
      meta: { label: "Name", hideable: false },
    },
    {
      id: "programme",
      header: "Programme",
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger className="cursor-default text-muted-foreground">{row.original.programme.code}</TooltipTrigger>
          <TooltipContent>{row.original.programme.name}</TooltipContent>
        </Tooltip>
      ),
      meta: { label: "Programme" },
    },
    {
      id: "year",
      header: () => <ColumnHeader title="Year" sortKey="year" />,
      cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.academicYear}</span>,
      meta: { label: "Year" },
    },
    { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} />, meta: { label: "Status" } },
  ];
  if (showFinance) {
    cols.push(
      {
        id: "balance",
        header: "Balance",
        cell: ({ row }) => {
          const a = row.original.account;
          return a ? <span className={cn("tabular-nums", a.isOverdue && "font-semibold text-rose-600 dark:text-rose-400")}>{formatGBP(a.balancePence)}</span> : null;
        },
        meta: { label: "Balance", className: "text-right" },
      },
      {
        id: "fees",
        header: "Fees",
        cell: ({ row }) => {
          const a = row.original.account;
          return a ? <AccountBadge state={a.state} daysOverdue={a.daysOverdue} creditPence={a.creditPence} /> : null;
        },
        meta: { label: "Fees" },
      },
    );
  }
  return cols;
}

function Empty({ hasFilters, canEnrol, pastEnd }: { hasFilters: boolean; canEnrol: boolean; pastEnd: boolean }) {
  const { navigate } = useTableNav();
  if (pastEnd) {
    return (
      <EmptyState title="No students on this page" icon={Users}>
        <Button variant="link" className="h-auto p-0" onClick={() => navigate({ page: 1 })}>Go to first page</Button>
      </EmptyState>
    );
  }
  if (hasFilters) {
    return (
      <EmptyState title="No students match your filters" icon={Users}>
        <Button variant="link" className="h-auto p-0" onClick={() => navigate({ filters: { q: undefined, programmeId: undefined, status: undefined } })}>Clear filters</Button>
      </EmptyState>
    );
  }
  return (
    <EmptyState title="No students yet" icon={Users}>
      {canEnrol ? <Link href="/staff/students?enrol=1" className="font-medium text-primary hover:underline">Enrol the first student</Link> : "Students appear here once the Registry enrols them."}
    </EmptyState>
  );
}

export function StudentsTable({
  state,
  rows,
  total,
  pageCount,
  showFinance,
  canEnrol,
  hasFilters,
  programmes,
  statuses,
}: {
  state: TableState;
  rows: StudentRow[];
  total: number;
  pageCount: number;
  showFinance: boolean;
  canEnrol: boolean;
  hasFilters: boolean;
  programmes: Option[];
  statuses: Option[];
}) {
  return (
    <TableNavProvider state={state}>
      <DataTable
        tableId="students"
        columns={columns(showFinance)}
        data={rows}
        total={total}
        pageCount={pageCount}
        noun="student"
        getRowId={(r) => r.id}
        toolbar={
          <>
            <SearchInput placeholder="Search name, Student ID or email…" />
            <FacetedFilter paramKey="programmeId" title="Programme" options={programmes} />
            <FacetedFilter paramKey="status" title="Status" options={statuses} />
          </>
        }
        emptyState={<Empty hasFilters={hasFilters} canEnrol={canEnrol} pastEnd={rows.length === 0 && total > 0} />}
      />
    </TableNavProvider>
  );
}
