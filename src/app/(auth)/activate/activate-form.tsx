"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { z } from "zod";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { PASSWORD_MIN, passwordSchema } from "@/lib/validation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SubmitButton, TextField } from "@/components/form/form-fields";
import { useApiForm } from "@/components/form/use-api-form";

/** The API's activateSchema plus a confirmation field that never leaves the browser. */
const formSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export function ActivateForm({ token }: { token: string }) {
  const router = useRouter();
  const [linkProblem, setLinkProblem] = useState<string | null>(null);
  const { form, onSubmit, pending } = useApiForm(
    formSchema,
    async ({ password }) => {
      setLinkProblem(null);
      try {
        return await apiFetch<{ home: string }>("/api/auth/activate", { method: "POST", json: { token, password } });
      } catch (err) {
        // Expired / already-used / unknown link: a dead end the user can't fix by retyping.
        if (err instanceof ApiClientError && (err.fields.token || err.status === 404 || err.code === "BUSINESS_RULE")) {
          setLinkProblem(err.fields.token ?? err.message);
        }
        throw err;
      }
    },
    {
      refresh: false,
      defaultValues: { password: "", confirm: "" },
      onSuccess: (r) => {
        router.push(r.home);
        router.refresh();
      },
    },
  );

  if (linkProblem) {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>{linkProblem}</AlertTitle>
        <AlertDescription>
          <Link href="/login" className="font-medium underline underline-offset-4">Go to sign in</Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4">
      <TextField form={form} name="password" label="New password" type="password" autoComplete="new-password" hint={`At least ${PASSWORD_MIN} characters, and not your email address`} />
      <TextField form={form} name="confirm" label="Confirm password" type="password" autoComplete="new-password" />
      <SubmitButton pending={pending} pendingLabel="Activating…" className="w-full">Activate account</SubmitButton>
    </form>
  );
}
