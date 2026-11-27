"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { FormError, useAction } from "@/components/forms";
import { formatDateTime } from "@/lib/format";

type Status = "ACTIVE" | "PENDING" | "DISABLED" | "NONE";

/** Shows whether the student can sign in, and lets staff issue a fresh activation link. */
export function PortalAccount({ studentId, status, lastLoginAt, canManage }: { studentId: string; status: Status; lastLoginAt: string | null; canManage: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const action = useAction(() => apiFetch<{ url: string }>(`/api/students/${studentId}/activation-link`, { method: "POST" }), {
    refresh: false,
    onSuccess: (r) => setUrl(r.url),
  });

  return (
    <div className="space-y-2 text-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Student portal account</div>
      {status === "ACTIVE" && <p className="text-emerald-700">Active{lastLoginAt ? ` · last sign-in ${formatDateTime(lastLoginAt)}` : ""}</p>}
      {status === "DISABLED" && <p className="text-rose-700">Disabled — the student cannot sign in.</p>}
      {status === "NONE" && <p className="text-slate-500">No account.</p>}
      {status === "PENDING" && (
        <>
          <p className="text-amber-700">Invitation pending — the student hasn&apos;t set a password yet.</p>
          {canManage && !url && (
            <button className="btn btn-secondary btn-sm" disabled={action.pending} onClick={() => action.run()}>
              {action.pending ? "Generating…" : "Generate activation link"}
            </button>
          )}
          {url && (
            <div className="space-y-1">
              <div className="flex gap-2">
                <input readOnly value={url} className="input py-1 font-mono text-xs" aria-label="Activation link" onFocus={(e) => e.currentTarget.select()} />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(url);
                    setCopied(true);
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-slate-500">Valid for 72 hours, single use. Any earlier link no longer works.</p>
            </div>
          )}
          <FormError state={action} />
        </>
      )}
    </div>
  );
}
