"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Field, FormError, errorProps, useAction } from "@/components/forms";

/** <input type="datetime-local"> gives local wall-clock time; convert to an absolute ISO instant. */
const localToIso = (v: string) => (v ? new Date(v).toISOString() : "");

export function CreateAssessmentForm({ modules }: { modules: { id: string; label: string }[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [deadline, setDeadline] = useState("");
  const action = useAction(
    (body: object) => apiFetch("/api/assessments", { method: "POST", json: body }),
    {
      onSuccess: () => {
        ref.current?.reset();
        setDeadline("");
      },
    },
  );
  const f = action.fields;
  const inPast = deadline && new Date(deadline).getTime() < Date.now();

  return (
    <form
      ref={ref}
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        action.run({ ...data, deadline: localToIso(deadline) });
      }}
    >
      <FormError state={action} />
      <Field label="Title" name="title" error={f.title}>
        <input {...errorProps(f, "title")} className="input" placeholder="e.g. Coursework 1" />
      </Field>
      <Field label="Module" name="moduleId" error={f.moduleId}>
        <select {...errorProps(f, "moduleId")} className="input" defaultValue="">
          <option value="">Choose a module…</option>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </Field>
      <Field label="Submission deadline" name="deadline" error={f.deadline} hint="Your local time">
        <input {...errorProps(f, "deadline")} type="datetime-local" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </Field>
      {inPast && <p className="text-xs text-amber-700">This deadline is in the past — every submission will be marked late.</p>}
      <button className="btn btn-primary w-full" disabled={action.pending}>{action.pending ? "Creating…" : "Create assessment"}</button>
    </form>
  );
}
