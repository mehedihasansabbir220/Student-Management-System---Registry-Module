"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { formatGBP } from "@/domain/money";
import { apiFetch } from "@/lib/api-client";
import { STATUS_LABEL } from "@/lib/format";
import { notifyError, notifySuccess } from "@/components/feedback";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Status = keyof typeof STATUS_LABEL;

const CONSEQUENCES: Partial<Record<Status, string>> = {
  WITHDRAWN: "The student will no longer be able to submit work. Any outstanding balance stays on their account.",
  DEFERRED: "The student will not be able to submit work until they return to Enrolled.",
  COMPLETED: "The student will no longer be able to submit work.",
};

export function StatusEditor({ studentId, status, balancePence }: { studentId: string; status: Status; balancePence: number }) {
  const router = useRouter();
  const [next, setNext] = useState<Status>(status);
  const [pending, setPending] = useState(false);
  const changed = next !== status;

  async function save() {
    setPending(true);
    try {
      await apiFetch(`/api/students/${studentId}`, { method: "PATCH", json: { status: next } });
      notifySuccess(`Status changed to ${STATUS_LABEL[next]}`);
      router.refresh();
    } catch (err) {
      notifyError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Label htmlFor="status">Enrolment status</Label>
      <div className="flex gap-2">
        <Select value={next} onValueChange={(v) => setNext(v as Status)}>
          <SelectTrigger id="status" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={save} disabled={!changed || pending}>
          {pending && <Loader2 className="animate-spin" />} Update
        </Button>
      </div>
      {changed && CONSEQUENCES[next] && <Notice tone="amber">{CONSEQUENCES[next]}</Notice>}
      {changed && next === "COMPLETED" && balancePence > 0 && <Notice tone="red">This student still owes {formatGBP(balancePence)}.</Notice>}
    </div>
  );
}
