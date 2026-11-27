"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

export function UserMenu({ name, roleLabel, isDemo }: { name: string; roleLabel: string; isDemo: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Even if the network call failed, leave the signed-in UI.
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="text-right leading-tight">
        <div className="font-medium text-white">{name}</div>
        <div className="text-xs text-indigo-200">
          {roleLabel}
          {isDemo && <span className="ml-1.5 rounded bg-white/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Demo account</span>}
        </div>
      </div>
      <button onClick={signOut} disabled={pending} className="rounded-md border border-white/20 px-2.5 py-1.5 text-xs text-white hover:bg-white/10 disabled:opacity-60">
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
