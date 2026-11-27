import { parseJson, route } from "@/server/http";
import { requireStaff } from "@/server/session";
import { enterGrade } from "@/server/services/results";
import { gradeSchema } from "@/lib/validation";

/** Idempotent upsert of one mark — PUT is the right verb. */
export const PUT = route(async (req) => {
  const user = await requireStaff(req);
  const input = await parseJson(req, gradeSchema);
  return enterGrade(input, user.actor);
});
