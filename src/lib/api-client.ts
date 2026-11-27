/**
 * Browser-side fetch wrapper. Mirrors the server's error shape
 * (src/server/http.ts → ApiErrorBody) so forms can show field-level errors
 * and the request id can be quoted to support.
 *
 * Session handling: access tokens last 15 minutes. When the API answers
 * 401 TOKEN_EXPIRED, we refresh once (one shared refresh for all concurrent
 * requests) and retry. If the refresh itself fails, the session is over —
 * send the user to the login page with a link back to where they were.
 */

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly fields: Record<string, string> = {},
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type Options = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit };
type ErrorBody = { error?: { code: string; message: string; fields?: Record<string, string>; requestId?: string } };

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time; every caller awaiting it shares the outcome. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function send(url: string, opts: Options): Promise<{ res: Response; data: unknown }> {
  const { json, headers, ...init } = opts;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...(json !== undefined && { "content-type": "application/json" }), ...(headers as Record<string, string>) },
      body: json !== undefined ? JSON.stringify(json) : opts.body,
    });
  } catch {
    throw new ApiClientError("Could not reach the server. Check your connection and try again.", 0, "NETWORK_ERROR");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  return { res, data };
}

export const isExpiredResponse = (status: number, data: unknown) => status === 401 && (data as ErrorBody | null)?.error?.code === "TOKEN_EXPIRED";
const isExpired = (res: Response, data: unknown) => isExpiredResponse(res.status, data);

/** The client-side error for a non-2xx response, from the server's standard error body. */
export function toApiError(status: number, data: unknown): ApiClientError {
  const e = (data as ErrorBody | null)?.error;
  if (e) return new ApiClientError(e.message, status, e.code, e.fields, e.requestId);
  return new ApiClientError(`The server returned an unexpected response (${status}).`, status, "UNEXPECTED_RESPONSE");
}

/** Session is over: go to sign-in and come back here afterwards. */
export function sessionEnded(): ApiClientError {
  const here = `${globalThis.location?.pathname ?? "/"}${globalThis.location?.search ?? ""}`;
  globalThis.location?.assign(`/login?next=${encodeURIComponent(here)}`);
  return new ApiClientError("Your session has ended. Please sign in again.", 401, "SESSION_EXPIRED");
}

export async function apiFetch<T = unknown>(url: string, opts: Options = {}): Promise<T> {
  let { res, data } = await send(url, opts);

  if (isExpired(res, data)) {
    if (!(await refreshSession())) throw sessionEnded();
    ({ res, data } = await send(url, opts));
  }

  if (!res.ok) throw toApiError(res.status, data);
  return data as T;
}
