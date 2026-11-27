import { parseJson, route } from "@/server/http";
import { requirePermission } from "@/server/session";
import { getStudent, updateStudent } from "@/server/services/students";
import { updateStudentSchema } from "@/lib/validation";

type Params = { id: string };

export const GET = route<Params>(async (req, { params }) => {
  await requirePermission(req, "students.read");
  return getStudent(params.id);
});

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requirePermission(req, "students.write");
  const input = await parseJson(req, updateStudentSchema);
  return updateStudent(params.id, input, user.actor);
});
