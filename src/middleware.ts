import { NextResponse, type NextRequest } from "next/server";
import { pageAccess } from "@/lib/access";
import { SESSION_COOKIE, parseSessionCookie } from "@/lib/session-cookie";

/**
 * Page routing by role (edge runtime — cookie only, no DB).
 * Also stamps every request with an x-request-id so logs from pages and API
 * routes can be correlated end to end.
 */
export function middleware(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const headers = new Headers(req.headers);
  headers.set("x-request-id", requestId);

  if (!req.nextUrl.pathname.startsWith("/api")) {
    const target = pageAccess(req.nextUrl.pathname, parseSessionCookie(req.cookies.get(SESSION_COOKIE)?.value));
    if (target) return NextResponse.redirect(new URL(target, req.url));
  }

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
