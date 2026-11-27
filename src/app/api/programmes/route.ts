import { route } from "@/server/http";
import { requireStaff } from "@/server/session";
import { listProgrammes } from "@/server/services/students";

export const GET = route(async (req) => {
  await requireStaff(req);
  return { items: await listProgrammes() };
});
