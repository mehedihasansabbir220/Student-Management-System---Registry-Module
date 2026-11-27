import "server-only";
import type { NextResponse } from "next/server";
import { ACCESS_TTL_SECONDS } from "@/lib/auth/jwt";
import { REFRESH_TTL_MS } from "../services/auth";

export const ACCESS_COOKIE = "sms_at";
export const REFRESH_COOKIE = "sms_rt";

const secure = process.env.NODE_ENV === "production";

/**
 * Both cookies are httpOnly (JavaScript can't read them, so XSS can't steal them).
 * The refresh cookie is SameSite=Strict and scoped to /api/auth, so the browser
 * only ever sends it to the refresh/logout endpoints.
 */
export function setAuthCookies(res: NextResponse, s: { accessToken: string; refreshToken: string }) {
  res.cookies.set(ACCESS_COOKIE, s.accessToken, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: ACCESS_TTL_SECONDS });
  res.cookies.set(REFRESH_COOKIE, s.refreshToken, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/api/auth",
    maxAge: Math.floor(REFRESH_TTL_MS / 1000),
  });
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, sameSite: "strict", secure, path: "/api/auth", maxAge: 0 });
}
