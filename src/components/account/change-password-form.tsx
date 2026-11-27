"use client";

import { z } from "zod";
import { apiFetch } from "@/lib/api-client";
import { PASSWORD_MIN, changePasswordSchema } from "@/lib/validation";
import { SubmitButton, TextField } from "@/components/form/form-fields";
import { useApiForm } from "@/components/form/use-api-form";

const formSchema = changePasswordSchema
  .extend({ confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export function ChangePasswordForm({ disabled }: { disabled: boolean }) {
  const { form, onSubmit, pending } = useApiForm(
    formSchema,
    ({ currentPassword, newPassword }) =>
      apiFetch<{ revokedSessions: number }>("/api/auth/change-password", { method: "POST", json: { currentPassword, newPassword } }),
    {
      defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
      successToast: "Password changed. Your other sessions have been signed out.",
      onSuccess: () => form.reset(),
    },
  );

  return (
    <form noValidate onSubmit={onSubmit} className="grid max-w-sm gap-4">
      <fieldset disabled={disabled} className="grid gap-4 disabled:opacity-60">
        <TextField form={form} name="currentPassword" label="Current password" type="password" autoComplete="current-password" />
        <TextField form={form} name="newPassword" label="New password" type="password" autoComplete="new-password" hint={`At least ${PASSWORD_MIN} characters, and not your email address`} />
        <TextField form={form} name="confirm" label="Confirm new password" type="password" autoComplete="new-password" />
        <div>
          <SubmitButton pending={pending} pendingLabel="Saving…">Change password</SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
