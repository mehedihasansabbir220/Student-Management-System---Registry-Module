import { parseJson, route } from "@/server/http";
import { requireStaff } from "@/server/session";
import { withholdResults } from "@/server/services/results";
import { withholdResultsSchema } from "@/lib/validation";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireStaff(req);
  const input = await parseJson(req, withholdResultsSchema);
  return withholdResults(params.id, input, user.actor);
});
