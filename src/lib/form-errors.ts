import { ApiClientError } from "@/lib/api-client";

export type DescribedError = { title: string; description?: string; fields: Record<string, string> };

const GENERIC = "Something went wrong. Please try again.";
const OFFLINE = "Can't reach the server. Check your connection and try again.";

/**
 * Turns anything a form submission can throw into what the UI shows: a toast
 * title, an optional "Reference: <requestId>" line to quote to support, and
 * per-field messages to put under inputs. The server is the source of truth
 * for validation, so its wording is kept as-is.
 */
export function describeError(err: unknown): DescribedError {
  if (err instanceof ApiClientError) {
    if (err.code === "NETWORK_ERROR") return { title: OFFLINE, fields: {} };
    return {
      title: err.message || GENERIC,
      ...(err.requestId && { description: `Reference: ${err.requestId}` }),
      fields: err.fields ?? {},
    };
  }
  if (err instanceof TypeError) return { title: OFFLINE, fields: {} };
  return { title: GENERIC, fields: {} };
}
