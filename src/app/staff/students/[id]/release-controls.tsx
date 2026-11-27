"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { FormError, useAction } from "@/components/forms";
import { formatDateTime } from "@/lib/format";

const REASONS = ["Outstanding tuition fees", "Pending moderation by external examiner", "Academic misconduct investigation", "Mitigating circumstances under review"];

export function ReleaseControls(props: {
  studentId: string;
  status: "PUBLISHED" | "WITHHELD";
  reason: string | null;
  publishedAt: string | null;
  gradeCount: number;
  isOverdue: boolean;
  compact?: boolean;
}) {
  const { studentId, status, gradeCount, isOverdue } = props;
  const [withholding, setWithholding] = useState(false);
  const [reason, setReason] = useState(isOverdue ? REASONS[0] : "");
  const [share, setShare] = useState(false);

  const publish = useAction(() => apiFetch(`/api/students/${studentId}/results/publish`, { method: "POST" }));
  const withhold = useAction(() => apiFetch(`/api/students/${studentId}/results/withhold`, { method: "POST", json: { reason, shareReason: share } }), {
    onSuccess: () => setWithholding(false),
  });

  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-600">
        {status === "PUBLISHED"
          ? <>Results are <strong className="text-emerald-700">visible to the student</strong>{props.publishedAt && <> since {formatDateTime(props.publishedAt)}</>}.</>
          : <>Results are <strong className="text-amber-700">hidden from the student</strong>{props.reason && <> — {props.reason}</>}.</>}
      </p>
      {status === "WITHHELD" && isOverdue && gradeCount > 0 && (
        <p className="text-xs text-amber-700">This student has an overdue balance. Check Registry policy before publishing.</p>
      )}
      <FormError state={publish.error ? publish : withhold} />

      {!withholding ? (
        <div className="flex flex-wrap gap-2">
          {status === "WITHHELD" && (
            <button className="btn btn-primary btn-sm" disabled={publish.pending || gradeCount === 0} onClick={() => publish.run()} title={gradeCount === 0 ? "No grades to publish" : undefined}>
              {publish.pending ? "Publishing…" : "Publish results"}
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setWithholding(true)}>
            {status === "PUBLISHED" ? "Withhold results" : props.reason ? "Change withhold reason" : "Withhold with reason"}
          </button>
        </div>
      ) : (
        <form
          className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            withhold.run();
          }}
        >
          <label htmlFor={`reason-${studentId}`} className="block text-xs font-medium text-slate-700">Reason (recorded in the audit log)</label>
          <input id={`reason-${studentId}`} list={`reasons-${studentId}`} className="input" value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={withhold.fields.reason ? true : undefined} />
          <datalist id={`reasons-${studentId}`}>{REASONS.map((r) => <option key={r} value={r} />)}</datalist>
          {withhold.fields.reason && <p className="text-xs text-rose-600">{withhold.fields.reason}</p>}
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Show this reason to the student
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setWithholding(false)}>Cancel</button>
            <button className="btn btn-danger btn-sm" disabled={withhold.pending}>{withhold.pending ? "Saving…" : "Withhold results"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
