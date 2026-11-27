"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Check, Copy, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { STATUS_LABEL } from "@/lib/format";
import { createStudentSchema } from "@/lib/validation";
import { notifySuccess } from "@/components/feedback";
import { SelectField, SubmitButton, TextField } from "@/components/form/form-fields";
import { useApiForm } from "@/components/form/use-api-form";
import { Notice } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Programme = { id: string; label: string; fee: string };
type Enrolled = { id: string; studentNumber: string; fullName: string; activationUrl: string };

function EnrolForm({ programmes, defaultAcademicYear, onEnrolled, onCancel }: { programmes: Programme[]; defaultAcademicYear: string; onEnrolled: (s: Enrolled) => void; onCancel: () => void }) {
  const { form, onSubmit, pending } = useApiForm(createStudentSchema, (v) => apiFetch<Enrolled>("/api/students", { method: "POST", json: v }), {
    defaultValues: { fullName: "", email: "", dateOfBirth: undefined, academicYear: defaultAcademicYear, programmeId: "", status: "ENROLLED" },
    onSuccess: onEnrolled,
  });
  const fee = programmes.find((p) => p.id === form.watch("programmeId"))?.fee;

  return (
    <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="grid gap-4 overflow-y-auto px-4">
        <TextField form={form} name="fullName" label="Full name" autoComplete="off" />
        <TextField form={form} name="email" label="Email" type="email" autoComplete="off" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField form={form} name="dateOfBirth" label="Date of birth" type="date" hint="Students must be at least 16" />
          <TextField form={form} name="academicYear" label="Academic year" hint="Format YYYY/YY" />
        </div>
        <SelectField
          form={form}
          name="programmeId"
          label="Programme"
          placeholder="Choose a programme…"
          options={programmes.map((p) => ({ value: p.id, label: p.label }))}
          hint={fee ? `Annual fee ${fee} will be assigned, due in 30 days` : undefined}
        />
        <SelectField form={form} name="status" label="Enrolment status" options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
      </div>
      <SheetFooter className="mt-auto flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <SubmitButton pending={pending} pendingLabel="Enrolling…">Enrol student</SubmitButton>
      </SheetFooter>
    </form>
  );
}

/** Shown exactly once: the raw activation token is never retrievable again (a new one can be issued). */
function EnrolledPanel({ student, onAnother }: { student: Enrolled; onAnother: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(student.activationUrl);
      setCopied(true);
      notifySuccess("Link copied");
    } catch {
      // Clipboard can be blocked (permissions, non-secure origin): the field stays selectable.
      setCopied(false);
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid gap-4 px-4">
        <Notice tone="green">
          <strong>{student.fullName}</strong> is enrolled as <span className="font-mono">{student.studentNumber}</span>. The programme fee has been assigned.
        </Notice>
        <div className="grid gap-1.5">
          <Label htmlFor="activation-url">Student portal activation link</Label>
          <div className="flex gap-2">
            <Input id="activation-url" readOnly value={student.activationUrl} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="outline" onClick={copy} aria-label="Copy activation link">
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Send this to the student so they can set a password. It works once and expires in 72 hours. It won&apos;t be shown again, but you can issue a new one from their record.
          </p>
        </div>
      </div>
      <SheetFooter className="mt-auto flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onAnother}>Enrol another</Button>
        <Button asChild>
          <Link href={`/staff/students/${student.id}`}>View student</Link>
        </Button>
      </SheetFooter>
    </div>
  );
}

export function EnrolStudentSheet({ programmes, defaultAcademicYear, openOnLoad }: { programmes: Programme[]; defaultAcademicYear: string; openOnLoad: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(openOnLoad);
  const [enrolled, setEnrolled] = useState<Enrolled | null>(null);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setEnrolled(null);
      // Drop ?enrol=1 so a reload doesn't reopen the sheet.
      if (params.has("enrol")) {
        const q = new URLSearchParams(params);
        q.delete("enrol");
        router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button><Plus /> Enrol student</Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{enrolled ? "Student enrolled" : "Enrol a student"}</SheetTitle>
          <SheetDescription>A Student ID is generated automatically and the programme fee is assigned.</SheetDescription>
        </SheetHeader>
        {enrolled ? (
          <EnrolledPanel student={enrolled} onAnother={() => setEnrolled(null)} />
        ) : (
          <EnrolForm programmes={programmes} defaultAcademicYear={defaultAcademicYear} onEnrolled={setEnrolled} onCancel={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  );
}
