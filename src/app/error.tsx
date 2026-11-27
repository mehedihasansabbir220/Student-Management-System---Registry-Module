"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Route-level error boundary. Details are logged server-side (instrumentation.ts); the user gets a reference. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto grid max-w-md place-items-center px-4 py-16 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
        <TriangleAlert className="size-5" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">This page failed to load</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The error has been logged. If it keeps happening, quote this reference to support:
        {error.digest && <code className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">{error.digest}</code>}
      </p>
      <Button onClick={reset} className="mt-6">Try again</Button>
    </div>
  );
}
