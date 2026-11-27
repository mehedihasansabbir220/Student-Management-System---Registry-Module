"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { FormError, useAction } from "@/components/forms";
import { STATUS_LABEL } from "@/lib/format";
import { formatGBP } from "@/domain/money";

type Status = keyof typeof STATUS_LABEL;

const CONSEQUENCES: Partial<Record<Status, string>> = {
  WITHDRAWN: "The student will no longer be able to submit work. Any outstanding balance stays on their account.",
  DEFERRED: "The student will not be able to submit work until they return to Enrolled.",
  COMPLETED: "The student will no longer be able to submit work.",
};

export function StatusEditor({ studentId, status, balancePence }: { studentId: string; status: Status; balancePence: number }) {
  const [next, setNext] = useState<Status>(status);
  const action = useAction((s: Status) => apiFetch(`/api/students/${studentId}`, { method: "PATCH", json: { status: s } }));
  const changed = next !== status;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        action.run(next);
      }}
    >
      <label htmlFor="status" className="block text-sm font-medium text-slate-700">Enrolment status</label>
      <div className="flex gap-2">
        <select id="status" className="input" value={next} onChange={(e) => setNext(e.target.value as Status)}>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn btn-primary" disabled={!changed || action.pending}>{action.pending ? "Saving…" : "Update"}</button>
      </div>
      {changed && CONSEQUENCES[next] && <p className="text-xs text-amber-700">{CONSEQUENCES[next]}</p>}
      {changed && next === "COMPLETED" && balancePence > 0 && (
        <p className="text-xs font-medium text-rose-600">Warning: this student still owes {formatGBP(balancePence)}.</p>
      )}
      <FormError state={action} />
    </form>
  );
}
