"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { Field, FormError, errorProps } from "@/components/forms";

export type DemoAccount = { label: string; description: string; email: string; password: string };
type LoginResult = { home: string };

export function LoginForm({ next, demoAccounts }: { next: string; demoAccounts: DemoAccount[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [state, setState] = useState<{ error: string | null; fields: Record<string, string>; requestId?: string }>({ error: null, fields: {} });

  async function signIn(email: string, password: string, key: string) {
    setPending(key);
    setState({ error: null, fields: {} });
    try {
      const res = await apiFetch<LoginResult>("/api/auth/login", { method: "POST", json: { email, password } });
      router.push(next || res.home);
      router.refresh();
    } catch (err) {
      setPending(null);
      if (err instanceof ApiClientError) setState({ error: err.message, fields: err.fields, requestId: err.requestId });
      else setState({ error: "Something went wrong. Please try again.", fields: {} });
    }
  }

  return (
    <div className="space-y-5">
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          signIn(String(f.get("email") ?? ""), String(f.get("password") ?? ""), "form");
        }}
      >
        <FormError state={state} />
        <Field label="Email" name="email" error={state.fields.email}>
          <input {...errorProps(state.fields, "email")} type="email" autoComplete="username" className="input" required />
        </Field>
        <Field label="Password" name="password" error={state.fields.password}>
          <input {...errorProps(state.fields, "password")} type="password" autoComplete="current-password" className="input" required />
        </Field>
        <button className="btn btn-primary w-full" disabled={!!pending}>{pending === "form" ? "Signing in…" : "Sign in"}</button>
      </form>

      {demoAccounts.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Demo accounts</div>
          <ul className="grid gap-2">
            {demoAccounts.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50/50 disabled:opacity-60"
                  disabled={!!pending}
                  onClick={() => signIn(a.email, a.password, a.email)}
                >
                  <span>
                    <span className="font-medium text-slate-900">{a.label}</span>
                    <span className="block text-xs text-slate-500">{a.description}</span>
                  </span>
                  <span className="text-xs text-indigo-700">{pending === a.email ? "Signing in…" : "Sign in →"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
