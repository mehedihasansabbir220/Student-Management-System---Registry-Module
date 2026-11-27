"use client";

import { useEffect, useState, type ReactNode } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type VisibilityState } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Pagination } from "./pagination";
import { useTableNav } from "./table-nav";

export type DataTableColumn<T> = ColumnDef<T> & { meta?: { label?: string; className?: string; hideable?: boolean } };

const storageKey = (id: string) => `sms.table.${id}.columns`;

function readVisibility(id: string): VisibilityState {
  try {
    return JSON.parse(localStorage.getItem(storageKey(id)) ?? "{}") as VisibilityState;
  } catch {
    return {};
  }
}

/**
 * Server-paginated, server-sorted table. Data arrives already filtered for the
 * current URL; navigation (sort/filter/page) goes through the URL so links are
 * shareable. Column visibility is a per-browser preference.
 */
export function DataTable<T>({
  tableId,
  columns,
  data,
  total,
  pageCount,
  toolbar,
  emptyState,
  noun,
  getRowId,
}: {
  tableId: string;
  columns: DataTableColumn<T>[];
  data: T[];
  total: number;
  pageCount: number;
  toolbar?: ReactNode;
  emptyState: ReactNode;
  noun?: string;
  getRowId?: (row: T) => string;
}) {
  const { pending } = useTableNav();
  const [visibility, setVisibility] = useState<VisibilityState>({});

  // localStorage is only available after mount (and may throw in private mode).
  useEffect(() => setVisibility(readVisibility(tableId)), [tableId]);

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { columnVisibility: visibility },
    onColumnVisibilityChange: (updater) => {
      setVisibility((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        try {
          localStorage.setItem(storageKey(tableId), JSON.stringify(next));
        } catch {
          /* preference only */
        }
        return next;
      });
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount,
  });

  const hideable = table.getAllLeafColumns().filter((c) => (c.columnDef as DataTableColumn<T>).meta?.hideable !== false && c.getCanHide());

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {toolbar}
        {hideable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto h-9">
                <Settings2 /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hideable.map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)} onSelect={(e) => e.preventDefault()}>
                  {(c.columnDef as DataTableColumn<T>).meta?.label ?? c.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="relative overflow-hidden rounded-lg border bg-card" aria-busy={pending}>
        {data.length === 0 ? (
          <div className="p-6">{emptyState}</div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                  {hg.headers.map((h) => (
                    <TableHead key={h.id} className={cn("h-10 text-xs font-medium text-muted-foreground", (h.column.columnDef as DataTableColumn<T>).meta?.className)}>
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cn("py-2.5", (cell.column.columnDef as DataTableColumn<T>).meta?.className)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {pending && <div className="absolute inset-0 animate-pulse bg-background/50" aria-hidden />}
      </div>

      {(total > 0 || pageCount > 1) && <Pagination total={total} pageCount={pageCount} noun={noun} />}
    </div>
  );
}
