import { homeFor, isStaff, type Role } from "@/domain/permissions";

const inArea = (path: string, area: string) => path === area || path.startsWith(`${area}/`);
const PUBLIC = ["/login", "/activate"];

/**
 * Page-level routing rule used by middleware. Returns where to redirect, or
 * null to let the request through. This is a UX layer only — authorisation is
 * enforced again in every API route and server page.
 *
 * `canRefresh`: the access token is missing/expired but a refresh session
 * exists, so try a silent refresh before sending the user to the login page.
 */
export function pageAccess(pathname: string, session: { role: Role } | null, opts: { canRefresh?: boolean } = {}): string | null {
  const protectedArea = inArea(pathname, "/staff") || inArea(pathname, "/me");

  if (!session) {
    if (pathname === "/") return "/login";
    if (!protectedArea) return null;
    const next = encodeURIComponent(pathname);
    return opts.canRefresh ? `/api/auth/refresh?next=${next}` : `/login?next=${next}`;
  }

  const home = homeFor(session.role);
  if (pathname === "/" || PUBLIC.some((p) => inArea(pathname, p))) return home;
  if (inArea(pathname, "/staff")) return isStaff(session.role) ? null : home;
  if (inArea(pathname, "/me")) return session.role === "STUDENT" ? null : home;
  return null;
}
