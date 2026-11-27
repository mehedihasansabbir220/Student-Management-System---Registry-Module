import type { SessionCookie } from "./session-cookie";

const inArea = (path: string, area: string) => path === area || path.startsWith(`${area}/`);

/**
 * Page-level routing rule used by middleware. Returns where to redirect, or
 * null to let the request through. This is a UX convenience only — the real
 * authorisation is enforced again in every API route and server page.
 */
export function pageAccess(pathname: string, session: SessionCookie | null): string | null {
  const home = session?.role === "STAFF" ? "/staff" : session?.role === "STUDENT" ? "/me" : "/";

  if (pathname === "/") return session ? home : null;
  if (inArea(pathname, "/staff")) return session?.role === "STAFF" ? null : home;
  if (inArea(pathname, "/me")) return session?.role === "STUDENT" ? null : home;
  return null;
}
