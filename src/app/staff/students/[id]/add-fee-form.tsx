"use client";

import { useRef } from "react";
import { apiFetch } from "@/lib/api-client";
import { Field, FormError, errorProps, useAction } from "@/components/forms";

export function AddFeeForm({ studentId }: { studentId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const action = useAction(
    (body: Record<string, FormDataEntryValue>) => apiFetch(`/api/students/${studentId}/fees`, { method: "POST", json: body }),
    { onSuccess: () => ref.current?.reset() },
  );
  const f = action.fields;

  return (
    <form
      ref={ref}
      noValidate
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        action.run(Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <h3 className="text-sm font-semibold text-slate-800">Add a charge</h3>
      <FormError state={action} />
      <Field label="Description" name="description" error={f.description}>
        <input {...errorProps(f, "description")} className="input" placeholder="e.g. Resit fee" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (£)" name="amount" error={f.amount}>
          <input {...errorProps(f, "amount")} inputMode="decimal" className="input" placeholder="0.00" />
        </Field>
        <Field label="Due date" name="dueDate" error={f.dueDate}>
          <input {...errorProps(f, "dueDate")} type="date" className="input" />
        </Field>
      </div>
      <button className="btn btn-secondary" disabled={action.pending}>{action.pending ? "Adding…" : "Add charge"}</button>
    </form>
  );
}
