"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Monitor } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { deviceLabel } from "@/lib/device-label";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/components/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Session = { familyId: string; createdAt: string; lastUsedAt: string; userAgent: string | null; ip: string | null; current: boolean };

export function SessionsCard({ isDemo }: { isDemo: boolean }) {
  const [items, setItems] = useState<Session[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await apiFetch<{ items: Session[] }>("/api/auth/sessions")).items);
      setFailed(false);
    } catch (err) {
      setFailed(true);
      notifyError(err);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function signOutOthers() {
    setPending(true);
    try {
      const { revoked } = await apiFetch<{ revoked: number }>("/api/auth/sessions", { method: "DELETE" });
      notifySuccess(revoked === 1 ? "Signed out 1 other session." : `Signed out ${revoked} other sessions.`);
      await load();
    } catch (err) {
      notifyError(err);
    } finally {
      setPending(false);
    }
  }

  const others = items?.filter((s) => !s.current).length ?? 0;

  return (
    <div className="grid gap-4">
      {items === null && !failed && (
        <div className="grid gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      )}
      {failed && (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load your sessions. <Button variant="link" className="h-auto p-0" onClick={load}>Try again</Button>
        </p>
      )}
      {items && (
        <ul className="divide-y rounded-md border">
          {items.map((s) => (
            <li key={s.familyId} className="flex items-center gap-3 px-4 py-3">
              <Monitor className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {deviceLabel(s.userAgent)}
                  {s.current && <Badge variant="secondary">This device</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  Signed in {formatDateTime(s.createdAt)} · last active {formatDateTime(s.lastUsedAt)}
                  {s.ip && ` · ${s.ip}`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {isDemo ? (
        <p className="text-sm text-muted-foreground">Demo accounts are shared, so this is turned off.</p>
      ) : (
        <div>
          <Button variant="outline" onClick={signOutOthers} disabled={pending || others === 0}>
            {pending && <Loader2 className="animate-spin" />}
            Sign out other sessions
          </Button>
        </div>
      )}
    </div>
  );
}
