import { route } from "@/server/http";
import { requirePermission } from "@/server/session";
import { getStaffMarksheet } from "@/server/services/results";

export const GET = route<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, "results.read");
  return getStaffMarksheet(params.id);
});
