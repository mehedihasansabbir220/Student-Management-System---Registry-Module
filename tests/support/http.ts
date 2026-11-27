import { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export type As = "none" | "staff" | { studentId: string };

function cookieFor(as: As) {
  if (as === "none") return undefined;
  const value = as === "staff" ? { role: "STAFF" } : { role: "STUDENT", studentId: as.studentId };
  return `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(value))}`;
}

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Call an App Router route handler the way Next.js would. */
export async function call(
  handler: unknown,
  opts: { as?: As; method?: string; url?: string; json?: unknown; body?: BodyInit; params?: Record<string, string> } = {},
) {
  const headers = new Headers();
  const cookie = cookieFor(opts.as ?? "staff");
  if (cookie) headers.set("cookie", cookie);
  let body = opts.body;
  if (opts.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(opts.json);
  }
  const req = new NextRequest(opts.url ?? "http://localhost/api/test", { method: opts.method ?? "GET", headers, body });
  const res = await (handler as Handler)(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* non-JSON (file download) */
  }
  return { status: res.status, headers: res.headers, data: data as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}
