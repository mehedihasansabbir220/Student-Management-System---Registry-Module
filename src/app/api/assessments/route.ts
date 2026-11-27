import { created, parseJson, route } from "@/server/http";
import { requireStaff, requireStudent, requireUser } from "@/server/session";
import { createAssessment, listAssessmentsForStaff, listAssessmentsForStudent } from "@/server/services/assessments";
import { toPublicSubmission } from "@/server/services/serializers";
import { createAssessmentSchema } from "@/lib/validation";

/** Role-aware: staff see all with counts; students see their programme's with their own submission. */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  if (user.role !== "STUDENT") return { items: await listAssessmentsForStaff() };
  const student = await requireStudent(req);
  const items = await listAssessmentsForStudent(student.studentId);
  return { items: items.map((a) => ({ ...a, submission: a.submission && toPublicSubmission(a.submission) })) };
});

export const POST = route(async (req) => {
  const user = await requireStaff(req);
  const input = await parseJson(req, createAssessmentSchema);
  return created(await createAssessment(input, user.actor));
});
