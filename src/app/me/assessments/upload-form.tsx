"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { FormError, useAction } from "@/components/forms";

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function UploadForm({ assessmentId, isResubmission, willBeLate, maxMb }: { assessmentId: string; isResubmission: boolean; willBeLate: boolean; maxMb: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const action = useAction(
    (f: File) => {
      const form = new FormData();
      form.set("file", f);
      return apiFetch<{ isLate: boolean; version: number }>(`/api/assessments/${assessmentId}/submissions`, { method: "POST", body: form });
    },
    {
      onSuccess: (s) => {
        setDone(s.isLate ? "Submitted — this has been recorded as a late submission." : `Submitted successfully${s.version > 1 ? ` (version ${s.version})` : ""}.`);
        setFile(null);
        if (input.current) input.current.value = "";
      },
    },
  );

  // Fast client-side checks for UX; the server re-validates type (by content) and size.
  function pick(f: File | null) {
    setDone(null);
    setClientError(null);
    if (f && !/\.(pdf|docx)$/i.test(f.name)) setClientError("Only PDF or DOCX files can be submitted.");
    else if (f && f.size > maxMb * 1024 * 1024) setClientError(`Files must be ${maxMb} MB or smaller.`);
    setFile(f);
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (file && !clientError) action.run(file);
      }}
    >
      {willBeLate && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The deadline has passed. You can still submit once, but it will be <strong>flagged as late</strong> and cannot be replaced afterwards.
        </p>
      )}
      {isResubmission && <p className="text-xs text-slate-500">Uploading again will replace your current submission.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept={ACCEPT} onChange={(e) => pick(e.target.files?.[0] ?? null)} className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200" aria-label="Choose file" />
        <button className="btn btn-primary" disabled={!file || !!clientError || action.pending}>
          {action.pending ? "Uploading…" : isResubmission ? "Resubmit" : willBeLate ? "Submit late" : "Submit"}
        </button>
      </div>
      {clientError && <p className="text-sm text-rose-600" role="alert">{clientError}</p>}
      {!clientError && <FormError state={{ error: action.fields.file ?? action.error, requestId: action.requestId }} />}
      {done && <p className="text-sm text-emerald-700" role="status">{done}</p>}
    </form>
  );
}
