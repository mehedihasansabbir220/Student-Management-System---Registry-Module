import { parseJson, route } from "@/server/http";
import { requireStaff } from "@/server/session";
import { getStudent, updateStudent } from "@/server/services/students";
import { updateStudentSchema } from "@/lib/validation";

type Params = { id: string };

export const GET = route<Params>(async (req, { params }) => {
  await requireStaff(req);
  return getStudent(params.id);
});

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireStaff(req);
  const input = await parseJson(req, updateStudentSchema);
  return updateStudent(params.id, input, user.actor);
});
