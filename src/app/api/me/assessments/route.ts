import { route } from "@/server/http";
import { requireStudent } from "@/server/session";
import { listAssessmentsForStudent } from "@/server/services/assessments";
import { toPublicSubmission } from "@/server/services/serializers";

export const GET = route(async (req) => {
  const user = await requireStudent(req);
  const items = await listAssessmentsForStudent(user.studentId);
  return { items: items.map((a) => ({ ...a, submission: a.submission && toPublicSubmission(a.submission) })) };
});
