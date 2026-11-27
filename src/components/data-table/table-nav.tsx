"use client";

import { createContext, useContext, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { tableStateHref, type TableState } from "@/lib/table-state";

type Patch = Parameters<typeof tableStateHref>[2];
type Nav = { state: TableState; navigate: (patch: Patch) => void; pending: boolean; defaultPageSize: number };

const Ctx = createContext<Nav | null>(null);

/** Shares the URL-backed table state with the toolbar, headers and pagination. */
export function TableNavProvider({ state, defaultPageSize = 20, children }: { state: TableState; defaultPageSize?: number; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const navigate = (patch: Patch) => startTransition(() => router.push(tableStateHref(pathname, state, patch, defaultPageSize), { scroll: false }));
  return <Ctx.Provider value={{ state, navigate, pending, defaultPageSize }}>{children}</Ctx.Provider>;
}

export function useTableNav(): Nav {
  const nav = useContext(Ctx);
  if (!nav) throw new Error("useTableNav must be used inside <TableNavProvider>");
  return nav;
}
