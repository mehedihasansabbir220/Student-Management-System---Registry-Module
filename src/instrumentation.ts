import type { Instrumentation } from "next";

/**
 * Catches errors thrown while rendering Server Components / pages (which never
 * pass through our API route wrapper) and sends them to the structured logger,
 * so every server-side error ends up in the same log stream.
 *
 * The Node-only logger (uses node:fs) MUST be imported inside a
 * `process.env.NEXT_RUNTIME === "nodejs"` block: Next.js inlines that value at
 * build time, so the import is dead-code-eliminated from the Edge bundle.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logger } = await import("./server/logger");
    const headers = request.headers as Record<string, string | string[] | undefined>;
    logger.error("render error", {
      err,
      requestId: headers["x-request-id"],
      method: request.method,
      path: request.path,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    });
  } else {
    console.error("[edge] request error", err);
  }
};
