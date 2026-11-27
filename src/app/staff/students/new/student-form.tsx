"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Field, FormError, errorProps, useAction } from "@/components/forms";
import { STATUS_LABEL } from "@/lib/format";

type Programme = { id: string; label: string; fee: string };

export function StudentForm({ programmes, defaultAcademicYear }: { programmes: Programme[]; defaultAcademicYear: string }) {
  const router = useRouter();
  const [programmeId, setProgrammeId] = useState("");
  const [enrolled, setEnrolled] = useState<{ id: string; studentNumber: string; fullName: string; activationUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const action = useAction(
    (body: Record<string, FormDataEntryValue>) =>
      apiFetch<{ id: string; studentNumber: string; fullName: string; activationUrl: string }>("/api/students", { method: "POST", json: body }),
    { refresh: false, onSuccess: setEnrolled },
  );
  const f = action.fields;
  const fee = programmes.find((p) => p.id === programmeId)?.fee;

  // The activation link is shown exactly once, here — so show it before leaving the page.
  if (enrolled) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          <strong>{enrolled.fullName}</strong> is enrolled as <span className="font-mono">{enrolled.studentNumber}</span>. The programme fee has been assigned.
        </div>
        <div>
          <label htmlFor="activation-url" className="mb-1 block text-sm font-medium text-slate-700">Student portal activation link</label>
          <div className="flex gap-2">
            <input id="activation-url" readOnly value={enrolled.activationUrl} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                await navigator.clipboard?.writeText(enrolled.activationUrl);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Send this to the student so they can set a password. It works once and expires in 72 hours. You can generate a new one from their record.</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => { setEnrolled(null); setCopied(false); }}>Enrol another</button>
          <button type="button" className="btn btn-primary" onClick={() => router.push(`/staff/students/${enrolled.id}`)}>Open student record</button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        action.run(Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <FormError state={action} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="fullName" error={f.fullName}>
          <input {...errorProps(f, "fullName")} className="input" autoComplete="off" required />
        </Field>
        <Field label="Email" name="email" error={f.email}>
          <input {...errorProps(f, "email")} type="email" className="input" autoComplete="off" required />
        </Field>
        <Field label="Date of birth" name="dateOfBirth" error={f.dateOfBirth} hint="Students must be at least 16">
          <input {...errorProps(f, "dateOfBirth")} type="date" className="input" required />
        </Field>
        <Field label="Academic year" name="academicYear" error={f.academicYear} hint="Format YYYY/YY">
          <input {...errorProps(f, "academicYear")} defaultValue={defaultAcademicYear} className="input" pattern="\d{4}/\d{2}" required />
        </Field>
        <Field label="Programme" name="programmeId" error={f.programmeId} hint={fee ? `Annual fee ${fee} will be assigned, due in 30 days` : undefined}>
          <select {...errorProps(f, "programmeId")} className="input" value={programmeId} onChange={(e) => setProgrammeId(e.target.value)} required>
            <option value="">Choose a programme…</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Enrolment status" name="status" error={f.status}>
          <select {...errorProps(f, "status")} className="input" defaultValue="ENROLLED">
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
        <button className="btn btn-primary" disabled={action.pending}>{action.pending ? "Enrolling…" : "Enrol student"}</button>
      </div>
    </form>
  );
}
