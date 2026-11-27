import { NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { db } from "@/server/db";
import { ACCESS_COOKIE } from "@/server/auth/cookies";
import { signAccessToken } from "@/lib/auth/jwt";

/** Who the request comes from. "staff" is kept as an alias for "admin" (v1 tests). */
export type As = "none" | "staff" | "admin" | "finance" | "academic" | { studentId: string } | { cookie: string };

const ROLE_OF = { staff: "REGISTRY_ADMIN", admin: "REGISTRY_ADMIN", finance: "FINANCE", academic: "ACADEMIC" } as const satisfies Record<string, Role>;

/** One user per role per test (the DB is truncated before each test, so the cache is too). */
const cache = new Map<string, string>();
export function resetAuthCache() {
  cache.clear();
}

async function staffUserId(role: Role) {
  const hit = cache.get(role);
  if (hit && (await db.user.findUnique({ where: { id: hit }, select: { id: true } }))) return hit;
  const u = await db.user.create({ data: { role, email: `${role.toLowerCase()}.${Date.now()}.${cache.size}@test.local`, name: `Test ${role}` } });
  cache.set(role, u.id);
  return u.id;
}

async function studentUserId(studentId: string) {
  const existing = await db.user.findUnique({ where: { studentId }, select: { id: true } });
  if (existing) return existing.id;
  const s = await db.student.findUniqueOrThrow({ where: { id: studentId }, select: { email: true, fullName: true } });
  return (await db.user.create({ data: { role: "STUDENT", email: s.email, name: s.fullName, studentId } })).id;
}

/** A real, signed access-token cookie — the same thing the browser sends after login. */
export async function cookieFor(as: As): Promise<string | undefined> {
  if (as === "none") return undefined;
  if (typeof as === "object" && "cookie" in as) return as.cookie;
  if (typeof as === "object") {
    const sub = await studentUserId(as.studentId);
    return `${ACCESS_COOKIE}=${await signAccessToken({ sub, role: "STUDENT", sid: "test-session", studentId: as.studentId })}`;
  }
  const role = ROLE_OF[as];
  return `${ACCESS_COOKIE}=${await signAccessToken({ sub: await staffUserId(role), role, sid: "test-session" })}`;
}

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Call an App Router route handler the way Next.js would. */
export async function call(
  handler: unknown,
  opts: {
    as?: As;
    method?: string;
    url?: string;
    json?: unknown;
    body?: BodyInit;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
) {
  const headers = new Headers(opts.headers);
  const cookie = await cookieFor(opts.as ?? "staff");
  if (cookie) headers.set("cookie", [headers.get("cookie"), cookie].filter(Boolean).join("; "));
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
  return {
    status: res.status,
    headers: res.headers,
    setCookie: res.headers.getSetCookie(),
    data: data as Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  };
}
