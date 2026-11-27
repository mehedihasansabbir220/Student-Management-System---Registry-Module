import { route } from "@/server/http";
import { requirePermission } from "@/server/session";
import { listModules } from "@/server/services/assessments";

export const GET = route(async (req) => {
  await requirePermission(req, "students.read");
  return { items: await listModules() };
});
