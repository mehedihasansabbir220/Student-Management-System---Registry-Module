"use client";

import { useRouter } from "next/navigation";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { describeError } from "@/lib/form-errors";
import { notifyError, notifySuccess } from "@/components/feedback";

type Options<In, R> = {
  defaultValues?: DefaultValues<In>;
  onSuccess?: (result: R) => void;
  successToast?: string;
  /** Re-render Server Components after success (fresh balances etc.). Default true. */
  refresh?: boolean;
};

/**
 * react-hook-form + the shared zod schema for instant client-side checks, with
 * the API as the source of truth: field errors from the response are put on
 * their inputs, anything else becomes a toast with the request reference.
 * Values are kept on failure so the user never retypes a form. `submit` receives
 * the raw (typed) values once they pass the schema.
 */
export function useApiForm<S extends z.ZodType<FieldValues, FieldValues>, R = unknown>(
  schema: S,
  submit: (values: z.input<S>) => Promise<R>,
  opts: Options<z.input<S>, R> = {},
) {
  const router = useRouter();
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema as never) as never,
    defaultValues: opts.defaultValues,
    mode: "onTouched",
  });

  // Fields this form renders; an API error on any other field must still reach the user (toast).
  const formKeys = new Set([...Object.keys((schema as { shape?: object }).shape ?? {}), ...Object.keys(opts.defaultValues ?? {})]);

  const onSubmit = form.handleSubmit(async () => {
    try {
      // Validation passed, but send what the user typed: the API parses it again with the
      // same schema, and parsed values (Dates, pence) would not survive a JSON round trip.
      const result = await submit(form.getValues());
      if (opts.successToast) notifySuccess(opts.successToast);
      opts.onSuccess?.(result);
      if (opts.refresh !== false) router.refresh();
    } catch (err) {
      const { fields } = describeError(err);
      const known = Object.entries(fields).filter(([name]) => formKeys.has(name));
      for (const [name, message] of known) form.setError(name as Path<z.input<S>>, { type: "server", message });
      // Field-level problems are shown inline; everything else (and unknown fields) gets a toast.
      if (known.length === 0 || known.length < Object.keys(fields).length) notifyError(err);
    }
  });

  return { form, onSubmit, pending: form.formState.isSubmitting };
}
