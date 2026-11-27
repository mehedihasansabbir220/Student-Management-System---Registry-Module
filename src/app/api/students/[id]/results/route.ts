import { route } from "@/server/http";
import { requireStaff } from "@/server/session";
import { getStaffMarksheet } from "@/server/services/results";

export const GET = route<{ id: string }>(async (req, { params }) => {
  await requireStaff(req);
  return getStaffMarksheet(params.id);
});
