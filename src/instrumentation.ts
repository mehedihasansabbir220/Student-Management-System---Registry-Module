import type { Instrumentation } from "next";

/**
 * Catches errors thrown while rendering Server Components / pages (which never
 * pass through our API route wrapper) and sends them to the structured logger,
 * so every server-side error ends up in the same log stream.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.error("[edge] request error", err);
    return;
  }
  const { logger } = await import("@/server/logger");
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
};
