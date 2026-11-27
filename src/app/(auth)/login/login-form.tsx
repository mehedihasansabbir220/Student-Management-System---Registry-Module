"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, BookOpenCheck, ClipboardList, Landmark, Loader2, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Role } from "@/domain/permissions";
import { apiFetch } from "@/lib/api-client";
import { loginSchema } from "@/lib/validation";
import { notifyError } from "@/components/feedback";
import { SubmitButton, TextField } from "@/components/form/form-fields";
import { useApiForm } from "@/components/form/use-api-form";

export type DemoAccount = { role: Role; label: string; description: string; email: string; password: string };
type LoginResult = { home: string };

const ICON: Record<Role, LucideIcon> = { REGISTRY_ADMIN: ShieldCheck, FINANCE: Landmark, ACADEMIC: ClipboardList, STUDENT: BookOpenCheck };

function useSignIn(next: string) {
  const router = useRouter();
  return async (email: string, password: string) => {
    const res = await apiFetch<LoginResult>("/api/auth/login", { method: "POST", json: { email, password } });
    router.push(next || res.home);
    router.refresh();
  };
}

export function LoginForm({ next }: { next: string }) {
  const signIn = useSignIn(next);
  const { form, onSubmit, pending } = useApiForm(loginSchema, (v) => signIn(v.email, v.password), {
    refresh: false,
    defaultValues: { email: "", password: "" },
  });

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4">
      <TextField form={form} name="email" label="Email" type="email" autoComplete="username" />
      <TextField form={form} name="password" label="Password" type="password" autoComplete="current-password" />
      <SubmitButton pending={pending} pendingLabel="Signing in…" className="w-full">Sign in</SubmitButton>
    </form>
  );
}

/** One-click sign-in as each seeded role (DEMO_MODE only). */
export function DemoGrid({ next, demoAccounts }: { next: string; demoAccounts: DemoAccount[] }) {
  const signIn = useSignIn(next);
  const [pending, setPending] = useState<string | null>(null);

  async function go(a: DemoAccount) {
    setPending(a.email);
    try {
      await signIn(a.email, a.password);
    } catch (err) {
      setPending(null);
      notifyError(err);
    }
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {demoAccounts.map((a) => {
        const Icon = ICON[a.role];
        const busy = pending === a.email;
        return (
          <li key={a.email}>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => go(a)}
              aria-label={`Sign in as ${a.label}`}
              className="group flex h-full w-full items-start gap-3 rounded-lg border bg-card p-4 text-left shadow-xs transition hover:border-primary/40 hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 text-sm font-medium">
                  {a.label}
                  {busy ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{a.description}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
