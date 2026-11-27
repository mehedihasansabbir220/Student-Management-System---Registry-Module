import { route } from "@/server/http";
import { requireStaff } from "@/server/session";
import { publishResults } from "@/server/services/results";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireStaff(req);
  return publishResults(params.id, user.actor);
});
