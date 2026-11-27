"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTableNav } from "./table-nav";

const DEBOUNCE_MS = 300;

/** Debounced free-text filter bound to the `q` URL parameter. */
export function SearchInput({ placeholder, paramKey = "q" }: { placeholder: string; paramKey?: string }) {
  const { state, navigate } = useTableNav();
  const urlValue = state.filters[paramKey] ?? "";
  const [value, setValue] = useState(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Back/forward navigation changes the URL under us: follow it.
  useEffect(() => setValue(urlValue), [urlValue]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function onChange(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (next.trim() !== urlValue) navigate({ filters: { [paramKey]: next.trim() || undefined } });
    }, DEBOUNCE_MS);
  }

  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-9 pl-8" maxLength={100} />
    </div>
  );
}
