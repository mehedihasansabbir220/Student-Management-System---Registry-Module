import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { homeFor } from "@/domain/permissions";
import type { IssuedSession } from "../services/auth";
import { setAuthCookies } from "./cookies";

/** Standard success response for anything that signs a user in (login, activate). */
export function signedInResponse(session: IssuedSession) {
  const res = NextResponse.json({ user: session.user, home: homeFor(session.user.role) });
  setAuthCookies(res, session);
  return res;
}

/** Client IP for rate limiting. Behind a proxy, the first X-Forwarded-For entry is the client. */
export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function authMeta(req: NextRequest) {
  return { ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? undefined };
}
