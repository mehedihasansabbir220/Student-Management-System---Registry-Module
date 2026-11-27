"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTableNav } from "./table-nav";

const SIZES = [20, 50, 100];

export function Pagination({ total, pageCount, noun = "result" }: { total: number; pageCount: number; noun?: string }) {
  const { state, navigate, pending } = useTableNav();
  const from = total === 0 ? 0 : Math.min(total, (state.page - 1) * state.pageSize + 1);
  const to = Math.min(total, state.page * state.pageSize);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm">
      <span className="text-muted-foreground tabular-nums">
        {from > to ? `0 of ${total}` : `${from}–${to} of ${total}`} {total === 1 ? noun : `${noun}s`}
      </span>
      <div className="flex items-center gap-2">
        <span className="hidden text-muted-foreground sm:inline">Rows</span>
        <Select value={String(state.pageSize)} onValueChange={(v) => navigate({ pageSize: Number(v), page: 1 })}>
          <SelectTrigger size="sm" className="w-[72px]" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="px-1 text-muted-foreground tabular-nums">Page {Math.min(state.page, pageCount)} of {pageCount}</span>
        <Button variant="outline" size="icon" className="size-8" aria-label="Previous page" disabled={pending || state.page <= 1} onClick={() => navigate({ page: Math.min(state.page, pageCount + 1) - 1 })}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon" className="size-8" aria-label="Next page" disabled={pending || state.page >= pageCount} onClick={() => navigate({ page: state.page + 1 })}>
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
