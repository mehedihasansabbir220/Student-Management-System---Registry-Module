// Edge-safe (used by middleware): names only, no server imports.
export const ACCESS_COOKIE = "sms_at";
export const REFRESH_COOKIE = "sms_rt";
/**
 * Non-secret flag ("1") readable on every path. The real refresh cookie is
 * scoped to /api/auth, so middleware can't see it on page requests; this hint
 * lets middleware try a silent refresh instead of bouncing to the login page.
 */
export const SESSION_HINT_COOKIE = "sms_has_rt";
