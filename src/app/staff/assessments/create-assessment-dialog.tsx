"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { localInputToIso } from "@/lib/datetime-local";
import { createAssessmentSchema } from "@/lib/validation";
import { SelectField, SubmitButton, TextField } from "@/components/form/form-fields";
import { useApiForm } from "@/components/form/use-api-form";
import { Notice } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const EMPTY = { title: "", moduleId: "", deadline: "" };

export function CreateAssessmentDialog({ modules }: { modules: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useApiForm(
    createAssessmentSchema,
    // The input is wall-clock time in the user's zone: send the absolute instant.
    (v) => apiFetch("/api/assessments", { method: "POST", json: { ...v, deadline: localInputToIso(String(v.deadline)) ?? v.deadline } }),
    {
      defaultValues: EMPTY,
      successToast: "Assessment created",
      onSuccess: () => {
        setOpen(false);
        form.reset(EMPTY);
      },
    },
  );
  const iso = localInputToIso(String(form.watch("deadline") ?? ""));
  const inPast = iso !== null && new Date(iso).getTime() < Date.now();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus /> Create assessment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create an assessment</DialogTitle>
          <DialogDescription>Every student on the module&apos;s programme can submit to it.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={onSubmit} className="grid gap-4">
          <TextField form={form} name="title" label="Title" placeholder="e.g. Coursework 1" />
          <SelectField form={form} name="moduleId" label="Module" placeholder="Choose a module…" options={modules.map((m) => ({ value: m.id, label: m.label }))} />
          <TextField form={form} name="deadline" label="Submission deadline" type="datetime-local" hint="Your local time" />
          {inPast && <Notice tone="amber">This deadline is in the past, so every submission will be marked late.</Notice>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pending={pending} pendingLabel="Creating…">Create assessment</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
