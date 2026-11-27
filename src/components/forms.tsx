"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { ApiClientError } from "@/lib/api-client";

export type FormState = { pending: boolean; error: string | null; fields: Record<string, string>; requestId?: string };

/**
 * Wraps an async action with pending/error state. Field errors from the API's
 * standard error body are mapped onto inputs; the server is always the source
 * of truth for validation. On success the current route is refreshed so
 * Server Components re-render with fresh data (e.g. the new balance).
 */
export function useAction<A extends unknown[], R>(action: (...args: A) => Promise<R>, opts: { onSuccess?: (r: R) => void; refresh?: boolean } = {}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({ pending: false, error: null, fields: {} });

  const run = useCallback(
    async (...args: A) => {
      setState({ pending: true, error: null, fields: {} });
      try {
        const result = await action(...args);
        setState({ pending: false, error: null, fields: {} });
        opts.onSuccess?.(result);
        if (opts.refresh !== false) router.refresh();
        return result;
      } catch (err) {
        if (err instanceof ApiClientError) {
          setState({ pending: false, error: err.message, fields: err.fields, requestId: err.requestId });
        } else {
          console.error(err);
          setState({ pending: false, error: "Something went wrong. Please try again.", fields: {} });
        }
        return undefined;
      }
    },
    [action, opts, router],
  );

  return { ...state, run, reset: () => setState({ pending: false, error: null, fields: {} }) };
}

export function Field({ label, name, error, hint, children }: { label: string; name: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export function FormError({ state }: { state: Pick<FormState, "error" | "requestId"> }) {
  if (!state.error) return null;
  return (
    <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
      {state.error}
      {state.requestId && <span className="ml-1 text-xs text-rose-500">(ref {state.requestId.slice(0, 8)})</span>}
    </div>
  );
}

/** Props that wire an input to its error message for screen readers. */
export const errorProps = (fields: Record<string, string>, name: string) => ({
  id: name,
  name,
  "aria-invalid": fields[name] ? true : undefined,
  "aria-describedby": fields[name] ? `${name}-error` : undefined,
});
