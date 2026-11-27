"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/components/feedback";
import { ToneBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PortalStatus = "ACTIVE" | "PENDING" | "DISABLED" | "NONE";

export function PortalAccountBadge({ status }: { status: PortalStatus }) {
  if (status === "ACTIVE") return <ToneBadge tone="green">Account active</ToneBadge>;
  if (status === "PENDING") return <ToneBadge tone="amber">Invitation pending</ToneBadge>;
  if (status === "DISABLED") return <ToneBadge tone="red">Account disabled</ToneBadge>;
  return <ToneBadge>No portal account</ToneBadge>;
}

/** Shows whether the student can sign in, and lets staff issue a fresh activation link. */
export function PortalAccount({ studentId, status, lastLoginAt, canManage }: { studentId: string; status: PortalStatus; lastLoginAt: string | null; canManage: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);

  async function issue() {
    setPending(true);
    try {
      setUrl((await apiFetch<{ url: string }>(`/api/students/${studentId}/activation-link`, { method: "POST" })).url);
    } catch (err) {
      notifyError(err);
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url ?? "");
      setCopied(true);
      notifySuccess("Link copied");
    } catch {
      /* clipboard blocked: the field stays selectable */
    }
  }

  return (
    <div className="grid gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Student portal</span>
        <PortalAccountBadge status={status} />
      </div>
      {status === "ACTIVE" && <p className="text-muted-foreground">{lastLoginAt ? `Last sign-in ${formatDateTime(lastLoginAt)}` : "Hasn't signed in yet."}</p>}
      {status === "DISABLED" && <p className="text-muted-foreground">The student cannot sign in.</p>}
      {status === "PENDING" && (
        <>
          <p className="text-muted-foreground">The student hasn&apos;t set a password yet.</p>
          {canManage && !url && (
            <div>
              <Button variant="outline" size="sm" onClick={issue} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Generate activation link
              </Button>
            </div>
          )}
          {url && (
            <div className="grid gap-1.5">
              <div className="flex gap-2">
                <Input readOnly value={url} className="h-8 font-mono text-xs" aria-label="Activation link" onFocus={(e) => e.currentTarget.select()} />
                <Button variant="outline" size="sm" onClick={copy} aria-label="Copy activation link">{copied ? <Check /> : <Copy />}</Button>
              </div>
              <p className="text-xs text-muted-foreground">Valid for 72 hours, single use. Any earlier link no longer works.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
