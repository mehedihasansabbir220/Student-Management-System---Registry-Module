"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { addFeeSchema } from "@/lib/validation";
import { SubmitButton, TextField } from "@/components/form/form-fields";
import { useApiForm } from "@/components/form/use-api-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const EMPTY = { description: "", amount: "", dueDate: "" };

export function AddFeeDialog({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useApiForm(addFeeSchema, (v) => apiFetch(`/api/students/${studentId}/fees`, { method: "POST", json: v }), {
    defaultValues: EMPTY,
    successToast: "Charge added",
    onSuccess: () => {
      setOpen(false);
      form.reset(EMPTY);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus /> Add charge</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a charge</DialogTitle>
          <DialogDescription>For extra fees such as resits or late registration.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={onSubmit} className="grid gap-4">
          <TextField form={form} name="description" label="Description" placeholder="e.g. Resit fee" />
          <div className="grid grid-cols-2 gap-4">
            <TextField form={form} name="amount" label="Amount (£)" placeholder="0.00" inputClassName="tabular-nums" />
            <TextField form={form} name="dueDate" label="Due date" type="date" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pending={pending} pendingLabel="Adding…">Add charge</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
