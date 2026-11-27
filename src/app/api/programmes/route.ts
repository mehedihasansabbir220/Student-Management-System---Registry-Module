import { route } from "@/server/http";
import { requirePermission } from "@/server/session";
import { listProgrammes } from "@/server/services/students";

export const GET = route(async (req) => {
  await requirePermission(req, "students.read");
  return { items: await listProgrammes() };
});
