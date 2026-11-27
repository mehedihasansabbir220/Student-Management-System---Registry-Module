"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useAction } from "@/components/forms";
import { ClassificationPreview } from "./classification-preview";

/** Inline mark entry. Saves on Enter or blur, only when the value actually changed. */
export function GradeCell({ assessmentId, studentId, initial, hasSubmission }: { assessmentId: string; studentId: string; initial: number | null; hasSubmission: boolean }) {
  const [value, setValue] = useState(initial === null ? "" : String(initial));
  const [saved, setSaved] = useState(initial === null ? "" : String(initial));
  const action = useAction(
    (mark: string) => apiFetch<{ mark: number }>("/api/grades", { method: "PUT", json: { assessmentId, studentId, mark } }),
    { onSuccess: (g) => setSaved(String(g.mark)) },
  );
  const dirty = value.trim() !== saved && value.trim() !== "";
  const error = action.fields.mark ?? action.error;

  const save = () => {
    if (dirty && !action.pending) action.run(value.trim());
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          className="input w-20 py-1 text-right tabular-nums"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())}
          aria-label="Mark"
          aria-invalid={error ? true : undefined}
          disabled={action.pending}
        />
        <ClassificationPreview value={value} />
        {action.pending && <span className="text-xs text-slate-400">Saving…</span>}
        {!action.pending && !dirty && saved && !error && <span className="text-xs text-emerald-600" aria-label="Saved">✓</span>}
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {!hasSubmission && dirty && <p className="mt-1 text-xs text-amber-700">No submission received — check before saving.</p>}
    </div>
  );
}
