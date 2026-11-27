"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { StatusLabel } from "./status-label";

type S = { id: string; fullName: string; studentNumber: string; status: string; programme: string };

export function RolePicker({ students }: { students: S[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(key: string, body: object, to: string) {
    setPending(key);
    setError(null);
    try {
      await apiFetch("/api/session", { method: "POST", json: body });
      router.push(to);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in");
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
      <button className="btn btn-primary w-full py-3" disabled={!!pending} onClick={() => choose("staff", { role: "STAFF" }, "/staff")}>
        {pending === "staff" ? "Signing in…" : "Continue as Registry staff"}
      </button>
      <div className="relative py-2 text-center text-xs uppercase tracking-wide text-slate-400">
        <span className="bg-white px-2">or view as a student</span>
      </div>
      {students.length === 0 ? (
        <p className="text-center text-sm text-slate-500">No students yet — run <code className="rounded bg-slate-100 px-1">npm run db:seed</code>.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {students.map((s) => (
            <li key={s.id}>
              <button
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
                disabled={!!pending}
                onClick={() => choose(s.id, { role: "STUDENT", studentId: s.id }, "/me")}
              >
                <span>
                  <span className="font-medium text-slate-900">{s.fullName}</span>
                  <span className="ml-2 font-mono text-xs text-slate-500">{s.studentNumber}</span>
                </span>
                <span className="text-xs text-slate-500">
                  {s.programme} · <StatusLabel status={s.status} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
