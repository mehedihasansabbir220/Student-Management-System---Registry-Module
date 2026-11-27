import { route } from "@/server/http";
import { requireStudent } from "@/server/session";
import { getStudentResults } from "@/server/services/results";

export const GET = route(async (req) => {
  const user = await requireStudent(req);
  return getStudentResults(user.studentId);
});
