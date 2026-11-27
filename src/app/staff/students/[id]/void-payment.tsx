"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { voidPaymentSchema } from "@/lib/validation";
import { SubmitButton, TextareaField } from "@/components/form/form-fields";
import { useApiForm } from "@/components/form/use-api-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Payments are never deleted: voiding keeps the row, with a reason, in the audit trail. */
export function VoidPaymentButton({ paymentId, reference, amount }: { paymentId: string; reference: string; amount: string }) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useApiForm(voidPaymentSchema, (v) => apiFetch(`/api/payments/${paymentId}/void`, { method: "POST", json: v }), {
    defaultValues: { reason: "" },
    successToast: `Payment ${reference} voided`,
    onSuccess: () => setOpen(false),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-muted-foreground hover:text-destructive">Void</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Void payment {reference}?</DialogTitle>
          <DialogDescription>
            {amount} will no longer count towards the balance. The payment stays on record as voided, with your reason.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={onSubmit} className="grid gap-4">
          <TextareaField form={form} name="reason" label="Reason" placeholder="e.g. Recorded against the wrong student" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pending={pending} pendingLabel="Voiding…" variant="destructive">Void payment</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
