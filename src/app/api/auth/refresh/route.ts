import { NextResponse, type NextRequest } from "next/server";
import { route, toErrorResponse } from "@/server/http";
import { getContext } from "@/server/logger";
import { UnauthenticatedError } from "@/server/errors";
import { refresh } from "@/server/services/auth";
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from "@/server/auth/cookies";
import { authMeta } from "@/server/auth/respond";
import { safeNextPath } from "@/lib/safe-redirect";

async function rotate(req: NextRequest) {
  const raw = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!raw) throw new UnauthenticatedError();
  return refresh(raw, authMeta(req));
}

/** JSON refresh, used by the browser API client when it sees 401 TOKEN_EXPIRED. */
export const POST = route(async (req) => {
  try {
    const session = await rotate(req);
    const res = NextResponse.json({ user: session.user });
    setAuthCookies(res, session);
    return res;
  } catch (err) {
    const res = toErrorResponse(err, getContext()?.requestId ?? "unknown");
    if (res.status === 401) clearAuthCookies(res as NextResponse);
    return res;
  }
});

/**
 * Navigation refresh: middleware sends page requests with an expired access
 * token here. Success → back to the page. Failure → the login page (never back
 * to the page, which would loop), with cookies cleared.
 */
export const GET = route(async (req) => {
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  try {
    const session = await rotate(req);
    const res = NextResponse.redirect(new URL(next, req.url), 307);
    setAuthCookies(res, session);
    return res;
  } catch (err) {
    if (!(err instanceof UnauthenticatedError)) throw err;
    const res = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.url), 307);
    clearAuthCookies(res);
    return res;
  }
});
