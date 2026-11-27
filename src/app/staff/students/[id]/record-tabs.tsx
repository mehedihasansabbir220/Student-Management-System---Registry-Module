"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { StudentTab } from "@/lib/student-tabs";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LABEL: Record<StudentTab, string> = { overview: "Overview", finance: "Finance", coursework: "Coursework", results: "Results", activity: "Activity" };

/** Tabs bound to ?tab= so a link can open a specific tab; the server already resolved the initial one. */
export function RecordTabs({ tabs, initial, children }: { tabs: StudentTab[]; initial: StudentTab; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState<StudentTab>(initial);

  function change(next: string) {
    setValue(next as StudentTab);
    const q = new URLSearchParams(params);
    if (next === "overview") q.delete("tab");
    else q.set("tab", next);
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={value} onValueChange={change} className="gap-4">
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <TabsList>
          {tabs.map((t) => <TabsTrigger key={t} value={t}>{LABEL[t]}</TabsTrigger>)}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}
