"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { describeError } from "@/lib/form-errors";
import { notifyError } from "@/components/feedback";
import { Input } from "@/components/ui/input";
import { ClassificationPreview } from "./classification-preview";

/** Inline mark entry. Saves on Enter or blur, only when the value actually changed. */
export function GradeCell({ assessmentId, studentId, studentName, initial, hasSubmission, readOnly }: { assessmentId: string; studentId: string; studentName: string; initial: number | null; hasSubmission: boolean; readOnly: boolean }) {
  const [value, setValue] = useState(initial === null ? "" : String(initial));
  const [saved, setSaved] = useState(initial === null ? "" : String(initial));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = value.trim() !== saved && value.trim() !== "";

  if (readOnly) {
    return saved ? (
      <div className="flex items-center gap-2"><span className="w-14 text-right font-semibold tabular-nums">{saved}</span><ClassificationPreview value={saved} /></div>
    ) : (
      <span className="text-xs text-muted-foreground">Not graded</span>
    );
  }

  async function save() {
    if (!dirty || pending) return;
    setPending(true);
    setError(null);
    try {
      const g = await apiFetch<{ mark: number }>("/api/grades", { method: "PUT", json: { assessmentId, studentId, mark: value.trim() } });
      setSaved(String(g.mark));
      setValue(String(g.mark));
    } catch (err) {
      const d = describeError(err);
      if (d.fields.mark) setError(d.fields.mark);
      else notifyError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <Input
          className="h-8 w-20 text-right tabular-nums"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
          }}
          aria-label={`Mark for ${studentName}`}
          aria-invalid={error ? true : undefined}
          disabled={pending}
        />
        <ClassificationPreview value={value} />
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />}
        {!pending && !dirty && saved && !error && <Check className="size-4 text-emerald-600" aria-label="Saved" />}
      </div>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      {!hasSubmission && dirty && <p className="text-xs text-amber-700 dark:text-amber-400">No submission received. Check before saving.</p>}
    </div>
  );
}
