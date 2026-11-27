import { created, parseJson, parseQuery, route } from "@/server/http";
import { requireStaff } from "@/server/session";
import { createStudent, listStudents } from "@/server/services/students";
import { createStudentSchema, studentListQuerySchema } from "@/lib/validation";

export const GET = route(async (req) => {
  await requireStaff(req);
  return listStudents(parseQuery(req, studentListQuerySchema));
});

export const POST = route(async (req) => {
  const user = await requireStaff(req);
  const input = await parseJson(req, createStudentSchema);
  return created(await createStudent(input, user.actor));
});
