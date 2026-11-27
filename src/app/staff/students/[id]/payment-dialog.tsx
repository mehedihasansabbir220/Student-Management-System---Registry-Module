"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { formatGBP, toPence } from "@/domain/money";
import { apiFetch } from "@/lib/api-client";
import { METHOD_LABEL } from "@/lib/format";
import { recordPaymentSchema } from "@/lib/validation";
import { SelectField, SubmitButton, TextField } from "@/components/form/form-fields";
import { useApiForm } from "@/components/form/use-api-form";
import { Notice } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const today = () => new Date().toISOString().slice(0, 10);
/** Typed pounds → pence for the overpayment hint only (the server does the real parsing). */
function typedPence(v: unknown): number | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  try {
    return toPence(v);
  } catch {
    return null;
  }
}

export function RecordPaymentDialog({ studentId, balancePence }: { studentId: string; balancePence: number }) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useApiForm(recordPaymentSchema, (v) => apiFetch(`/api/students/${studentId}/payments`, { method: "POST", json: v }), {
    defaultValues: { amount: "", paidOn: today(), reference: "", method: "BANK_TRANSFER" },
    successToast: "Payment recorded",
    onSuccess: () => {
      setOpen(false);
      form.reset({ amount: "", paidOn: today(), reference: "", method: "BANK_TRANSFER" });
    },
  });
  const pence = typedPence(form.watch("amount"));
  const overpays = pence !== null && pence > balancePence;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> Record payment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>Outstanding balance: <span className="font-medium tabular-nums text-foreground">{formatGBP(Math.max(0, balancePence))}</span></DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={onSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField form={form} name="amount" label="Amount (£)" placeholder="0.00" inputClassName="tabular-nums" />
            <TextField form={form} name="paidOn" label="Date received" type="date" max={today()} />
            <TextField form={form} name="reference" label="Reference" hint="Bank / receipt reference" autoComplete="off" inputClassName="font-mono uppercase" />
            <SelectField form={form} name="method" label="Method" options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))} />
          </div>
          {overpays && <Notice tone="amber">This is more than the outstanding balance. The extra will be held as credit.</Notice>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pending={pending} pendingLabel="Saving…">Record payment</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
