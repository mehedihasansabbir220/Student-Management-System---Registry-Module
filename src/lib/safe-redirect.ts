/**
 * Only allow same-site, absolute-path redirects (`/staff/x`). Rejects
 * `//evil.com` (protocol-relative), `/\evil.com`, full URLs and anything else —
 * an open redirect on a login page is a classic phishing aid.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
