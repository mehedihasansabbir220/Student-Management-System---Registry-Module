"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Field, FormError, errorProps, useAction } from "@/components/forms";
import { METHOD_LABEL } from "@/lib/format";
import { formatGBP } from "@/domain/money";

const today = () => new Date().toISOString().slice(0, 10);

export function PaymentForm({ studentId, balancePence }: { studentId: string; balancePence: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [amount, setAmount] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const action = useAction(
    (body: Record<string, FormDataEntryValue>) => apiFetch(`/api/students/${studentId}/payments`, { method: "POST", json: body }),
    {
      onSuccess: () => {
        setSaved(`Payment of £${amount} recorded.`);
        formRef.current?.reset();
        setAmount("");
      },
    },
  );
  const f = action.fields;
  const amountPence = Math.round(Number(amount) * 100);
  const overpays = amount !== "" && Number.isFinite(amountPence) && amountPence > balancePence;

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(null);
        action.run(Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <h3 className="text-sm font-semibold text-slate-800">Record a payment</h3>
      <FormError state={action} />
      {saved && <p className="text-sm text-emerald-700" role="status">{saved}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (£)" name="amount" error={f.amount}>
          <input {...errorProps(f, "amount")} inputMode="decimal" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Date received" name="paidOn" error={f.paidOn}>
          <input {...errorProps(f, "paidOn")} type="date" className="input" defaultValue={today()} max={today()} />
        </Field>
        <Field label="Reference" name="reference" error={f.reference} hint="Bank / receipt reference">
          <input {...errorProps(f, "reference")} className="input font-mono uppercase" autoComplete="off" />
        </Field>
        <Field label="Method" name="method" error={f.method}>
          <select {...errorProps(f, "method")} className="input" defaultValue="BANK_TRANSFER">
            {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      {overpays && (
        <p className="text-xs text-amber-700">
          This is more than the outstanding balance ({formatGBP(balancePence)}). The extra will be held as credit.
        </p>
      )}
      <button className="btn btn-primary" disabled={action.pending}>{action.pending ? "Saving…" : "Record payment"}</button>
    </form>
  );
}
