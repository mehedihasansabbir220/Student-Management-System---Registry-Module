import { route } from "@/server/http";
import { requireUser } from "@/server/session";
import { listSessions, revokeOtherSessions } from "@/server/services/auth";

/** Your active sign-ins (devices). */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  return { items: await listSessions(user.userId, user.sessionId) };
});

/** "Sign out everywhere else" — only ever affects the caller's own sessions. */
export const DELETE = route(async (req) => {
  const user = await requireUser(req);
  return { revoked: await revokeOtherSessions(user.userId, user.sessionId) };
});
