import { NextResponse, type NextRequest } from "next/server";
import { pageAccess } from "@/lib/access";
import { ACCESS_COOKIE, SESSION_HINT_COOKIE } from "@/lib/auth/cookie-names";
import { verifyAccessToken } from "@/lib/auth/jwt";

/**
 * Edge middleware (no DB):
 *  - stamps every request with an x-request-id for end-to-end log correlation;
 *  - for page navigations, verifies the access JWT and routes by role.
 *    Expired/missing token but a live session → silent refresh via /api/auth/refresh.
 * This is a UX layer: pages and API routes re-check identity against the DB.
 */
export async function middleware(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const headers = new Headers(req.headers);
  headers.set("x-request-id", requestId);

  if (!req.nextUrl.pathname.startsWith("/api")) {
    let session: { role: Awaited<ReturnType<typeof verifyAccessToken>>["role"] } | null = null;
    const token = req.cookies.get(ACCESS_COOKIE)?.value;
    if (token) {
      try {
        session = { role: (await verifyAccessToken(token)).role };
      } catch {
        session = null; // expired, tampered or wrong secret → treated as signed out
      }
    }
    const canRefresh = req.cookies.get(SESSION_HINT_COOKIE)?.value === "1";
    const target = pageAccess(req.nextUrl.pathname, session, { canRefresh });
    if (target) {
      const res = NextResponse.redirect(new URL(target, req.url));
      res.headers.set("x-request-id", requestId);
      return res;
    }
  }

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
