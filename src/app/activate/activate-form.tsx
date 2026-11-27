"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Field, FormError, errorProps, useAction } from "@/components/forms";
import { PASSWORD_MIN } from "@/lib/validation";

export function ActivateForm({ token }: { token: string }) {
  const router = useRouter();
  const [mismatch, setMismatch] = useState(false);
  const action = useAction((password: string) => apiFetch<{ home: string }>("/api/auth/activate", { method: "POST", json: { token, password } }), {
    refresh: false,
    onSuccess: (r) => {
      router.push(r.home);
      router.refresh();
    },
  });
  const f = action.fields;

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const password = String(data.get("password") ?? "");
        const same = password === String(data.get("confirm") ?? "");
        setMismatch(!same);
        if (same) action.run(password);
      }}
    >
      <FormError state={action} />
      <Field label="New password" name="password" error={f.password} hint={`At least ${PASSWORD_MIN} characters`}>
        <input {...errorProps(f, "password")} type="password" autoComplete="new-password" className="input" />
      </Field>
      <Field label="Confirm password" name="confirm" error={mismatch ? "Passwords don't match" : undefined}>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" className="input" aria-invalid={mismatch || undefined} />
      </Field>
      <button className="btn btn-primary w-full" disabled={action.pending}>{action.pending ? "Activating…" : "Activate account"}</button>
    </form>
  );
}
