/**
 * Browser-side fetch wrapper. Mirrors the server's error shape
 * (src/server/http.ts → ApiErrorBody) so forms can show field-level errors
 * and the request id can be quoted to support.
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

export async function apiFetch<T = unknown>(url: string, opts: Options = {}): Promise<T> {
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

  if (!res.ok) {
    const e = (data as { error?: { code: string; message: string; fields?: Record<string, string>; requestId?: string } } | null)?.error;
    if (e) throw new ApiClientError(e.message, res.status, e.code, e.fields, e.requestId);
    throw new ApiClientError(`The server returned an unexpected response (${res.status}).`, res.status, "UNEXPECTED_RESPONSE");
  }
  return data as T;
}
