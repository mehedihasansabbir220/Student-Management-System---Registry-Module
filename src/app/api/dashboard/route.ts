import { route } from "@/server/http";
import { requireStaff } from "@/server/session";
import { getDashboard } from "@/server/services/dashboard";

export const GET = route(async (req) => {
  await requireStaff(req);
  return getDashboard();
});
