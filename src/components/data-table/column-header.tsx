"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTableNav } from "./table-nav";

/** Sortable header: click toggles asc ↔ desc for its server sort key. */
export function ColumnHeader({ title, sortKey, className }: { title: string; sortKey?: string; className?: string }) {
  const { state, navigate } = useTableNav();
  if (!sortKey) return <span className={className}>{title}</span>;
  const current = state.sort === sortKey ? "asc" : state.sort === `-${sortKey}` ? "desc" : null;
  const Icon = current === "asc" ? ArrowUp : current === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-2 h-8 px-2 data-[active=true]:text-foreground", className)}
      data-active={current !== null}
      aria-label={`Sort by ${title}${current === "asc" ? ", descending" : ""}`}
      onClick={() => navigate({ sort: current === "asc" ? `-${sortKey}` : sortKey })}
    >
      {title}
      <Icon className="size-3.5" />
    </Button>
  );
}
