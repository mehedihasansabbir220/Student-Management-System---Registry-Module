import { route } from "@/server/http";
import { requireUser } from "@/server/session";
import { BusinessRuleError } from "@/server/errors";
import { listSessions, revokeOtherSessions } from "@/server/services/auth";

/**
 * Your active sign-ins (devices). A shared demo account is used by many
 * reviewers at once: they only ever see their own session (no one else's IP
 * or browser) and cannot sign the others out.
 */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const items = await listSessions(user.userId, user.sessionId);
  return { items: user.isDemo ? items.filter((s) => s.current) : items };
});

/** "Sign out everywhere else" — only ever affects the caller's own sessions. */
export const DELETE = route(async (req) => {
  const user = await requireUser(req);
  if (user.isDemo) throw new BusinessRuleError("Signing out other sessions is disabled on shared demo accounts");
  return { revoked: await revokeOtherSessions(user.userId, user.sessionId) };
});
