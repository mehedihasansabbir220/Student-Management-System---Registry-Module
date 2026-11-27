import { parseJson, route } from "@/server/http";
import { requirePermission } from "@/server/session";
import { enterGrade } from "@/server/services/results";
import { gradeSchema } from "@/lib/validation";

/** Idempotent upsert of one mark — PUT is the right verb. */
export const PUT = route(async (req) => {
  const user = await requirePermission(req, "grades.write");
  const input = await parseJson(req, gradeSchema);
  return enterGrade(input, user.actor);
});
