import { route } from "@/server/http";
import { requireStaff } from "@/server/session";
import { listModules } from "@/server/services/assessments";

export const GET = route(async (req) => {
  await requireStaff(req);
  return { items: await listModules() };
});
