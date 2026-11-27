"use client";

import { useEffect } from "react";

/** Route-level error boundary. Details are logged server-side (instrumentation.ts); the user gets a reference. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-semibold text-rose-600">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-semibold">This page failed to load</h1>
      <p className="mt-2 text-sm text-slate-500">
        The error has been logged. If it keeps happening, quote this reference to support:
        {error.digest && <code className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{error.digest}</code>}
      </p>
      <button onClick={reset} className="btn btn-primary mt-6">Try again</button>
    </div>
  );
}
