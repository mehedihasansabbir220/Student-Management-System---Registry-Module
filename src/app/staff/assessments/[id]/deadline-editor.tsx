"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { FormError, useAction } from "@/components/forms";

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function DeadlineEditor({ assessmentId, deadline }: { assessmentId: string; deadline: string }) {
  const [value, setValue] = useState(() => toLocalInput(deadline));
  const action = useAction((iso: string) => apiFetch(`/api/assessments/${assessmentId}`, { method: "PATCH", json: { deadline: iso } }));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        action.run(new Date(value).toISOString());
      }}
    >
      <input type="datetime-local" className="input" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Deadline" />
      <p className="text-xs text-slate-500">
        Extending a deadline does not change submissions already flagged late — their status was recorded at upload time.
      </p>
      <FormError state={action} />
      <button className="btn btn-secondary w-full" disabled={action.pending || !value}>{action.pending ? "Saving…" : "Update deadline"}</button>
    </form>
  );
}
