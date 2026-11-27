import { NextResponse } from "next/server";
import { route } from "@/server/http";
import { logout } from "@/server/services/auth";
import { REFRESH_COOKIE, clearAuthCookies } from "@/server/auth/cookies";

/** Revokes the whole session family server-side, then clears the cookies. Always succeeds. */
export const POST = route(async (req) => {
  await logout(req.cookies.get(REFRESH_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
});
