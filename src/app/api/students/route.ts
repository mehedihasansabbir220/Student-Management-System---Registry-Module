import { created, parseJson, parseQuery, route } from "@/server/http";
import { requirePermission } from "@/server/session";
import { createStudent, listStudents } from "@/server/services/students";
import { createStudentSchema, studentListQuerySchema } from "@/lib/validation";

export const GET = route(async (req) => {
  await requirePermission(req, "students.read");
  return listStudents(parseQuery(req, studentListQuerySchema));
});

export const POST = route(async (req) => {
  const user = await requirePermission(req, "students.write");
  const input = await parseJson(req, createStudentSchema);
  const { activationToken, ...student } = await createStudent(input, user.actor);
  // Shown once to staff so they can pass it to the student (no email system — design §5.6).
  const activationUrl = new URL("/activate", req.nextUrl.origin);
  activationUrl.searchParams.set("token", activationToken);
  return created({ ...student, activationUrl: activationUrl.toString() });
});
