"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Titles = Record<string, string>;
const Ctx = createContext<{ titles: Titles; set: (id: string, label: string) => void } | null>(null);

export function BreadcrumbTitles({ children }: { children: ReactNode }) {
  const [titles, setTitles] = useState<Titles>({});
  const set = (id: string, label: string) => setTitles((t) => (t[id] === label ? t : { ...t, [id]: label }));
  return <Ctx.Provider value={{ titles, set }}>{children}</Ctx.Provider>;
}

export function useBreadcrumbTitles(): Titles {
  return useContext(Ctx)?.titles ?? {};
}

/** Lets a (server) page name its own dynamic breadcrumb, e.g. a student id → their name. */
export function BreadcrumbTitle({ id, label }: { id: string; label: string }) {
  const ctx = useContext(Ctx);
  useEffect(() => {
    ctx?.set(id, label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, label]);
  return null;
}
