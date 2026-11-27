import { parseJson, route } from "@/server/http";
import { requireUser } from "@/server/session";
import { changePassword } from "@/server/services/auth";
import { changePasswordSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const input = await parseJson(req, changePasswordSchema);
  return changePassword(user.userId, input, user.sessionId);
});
