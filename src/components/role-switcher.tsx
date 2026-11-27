"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

type Option = { id: string; label: string };

/** Simulated sign-in: switch between the Staff view and any student's view. */
export function RoleSwitcher({ current, students }: { current: string; students: Option[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(value: string) {
    setPending(true);
    setError(null);
    try {
      if (value === "") await apiFetch("/api/session", { method: "DELETE" });
      else if (value === "STAFF") await apiFetch("/api/session", { method: "POST", json: { role: "STAFF" } });
      else await apiFetch("/api/session", { method: "POST", json: { role: "STUDENT", studentId: value } });
      router.push(value === "" ? "/" : value === "STAFF" ? "/staff" : "/me");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch role");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="role" className="hidden text-xs font-medium text-indigo-100 sm:block">
        Viewing as
      </label>
      <select
        id="role"
        value={current}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        className="rounded-md border border-indigo-400/40 bg-indigo-800 px-2 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-white/40"
      >
        <option value="">— Signed out —</option>
        <option value="STAFF">Registry staff</option>
        <optgroup label="Students">
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </optgroup>
      </select>
      {error && <span className="text-xs text-rose-200">{error}</span>}
    </div>
  );
}
