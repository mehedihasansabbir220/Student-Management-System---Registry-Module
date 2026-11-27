"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useAction } from "@/components/forms";

/** Inline confirm (no browser dialogs): payments are voided with a reason, never deleted. */
export function VoidPaymentButton({ paymentId, reference }: { paymentId: string; reference: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const action = useAction((r: string) => apiFetch(`/api/payments/${paymentId}/void`, { method: "POST", json: { reason: r } }), {
    onSuccess: () => setOpen(false),
  });

  if (!open) {
    return <button className="text-xs text-slate-500 hover:text-rose-600" onClick={() => setOpen(true)}>Void</button>;
  }
  return (
    <form
      className="flex flex-col items-end gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        action.run(reason);
      }}
    >
      <input
        autoFocus
        className="input w-56 py-1 text-xs"
        placeholder={`Why void ${reference}?`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-label="Reason for voiding"
      />
      <div className="flex gap-1">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn btn-danger btn-sm" disabled={action.pending}>Void payment</button>
      </div>
      {(action.fields.reason || action.error) && <span className="text-xs text-rose-600">{action.fields.reason ?? action.error}</span>}
    </form>
  );
}
