import { parseJson, route } from "@/server/http";
import { requirePermission } from "@/server/session";
import { withholdResults } from "@/server/services/results";
import { withholdResultsSchema } from "@/lib/validation";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, "results.release");
  const input = await parseJson(req, withholdResultsSchema);
  return withholdResults(params.id, input, user.actor);
});
