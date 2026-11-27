import { parseJson, route } from "@/server/http";
import { requirePermission } from "@/server/session";
import { getAssessmentRoster, updateAssessment } from "@/server/services/assessments";
import { toPublicSubmission } from "@/server/services/serializers";
import { updateAssessmentSchema } from "@/lib/validation";

type Params = { id: string };

export const GET = route<Params>(async (req, { params }) => {
  await requirePermission(req, "submissions.read");
  const roster = await getAssessmentRoster(params.id);
  return { ...roster, rows: roster.rows.map((r) => ({ ...r, submission: r.submission && toPublicSubmission(r.submission) })) };
});

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requirePermission(req, "assessments.write");
  const input = await parseJson(req, updateAssessmentSchema);
  return updateAssessment(params.id, input, user.actor);
});
