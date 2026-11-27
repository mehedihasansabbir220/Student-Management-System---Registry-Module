"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { isoToLocalInput, localInputToIso } from "@/lib/datetime-local";
import { notifyError, notifySuccess } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeadlineEditor({ assessmentId, deadline }: { assessmentId: string; deadline: string }) {
  const router = useRouter();
  const [value, setValue] = useState(() => isoToLocalInput(deadline));
  const [pending, setPending] = useState(false);
  const iso = localInputToIso(value);
  const changed = iso !== null && iso !== new Date(deadline).toISOString();

  async function save() {
    if (!iso) return;
    setPending(true);
    try {
      await apiFetch(`/api/assessments/${assessmentId}`, { method: "PATCH", json: { deadline: iso } });
      notifySuccess("Deadline updated");
      router.refresh();
    } catch (err) {
      notifyError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Label htmlFor="deadline">Deadline (your local time)</Label>
      <Input id="deadline" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      <p className="text-xs text-muted-foreground">Extending a deadline does not change submissions already flagged late. Their status was recorded at upload time.</p>
      <Button variant="outline" onClick={save} disabled={pending || !changed}>
        {pending && <Loader2 className="animate-spin" />} Update deadline
      </Button>
    </div>
  );
}
