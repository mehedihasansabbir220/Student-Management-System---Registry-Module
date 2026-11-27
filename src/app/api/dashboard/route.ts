import { route } from "@/server/http";
import { requirePermission } from "@/server/session";
import { getDashboard } from "@/server/services/dashboard";

export const GET = route(async (req) => {
  await requirePermission(req, "dashboard.read");
  return getDashboard();
});
