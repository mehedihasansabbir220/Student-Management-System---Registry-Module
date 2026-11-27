import { route } from "@/server/http";
import { requirePermission } from "@/server/session";
import { publishResults } from "@/server/services/results";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, "results.release");
  return publishResults(params.id, user.actor);
});
