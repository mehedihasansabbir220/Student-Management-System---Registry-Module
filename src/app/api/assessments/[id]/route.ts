import { parseJson, route } from "@/server/http";
import { requireStaff } from "@/server/session";
import { getAssessmentRoster, updateAssessment } from "@/server/services/assessments";
import { toPublicSubmission } from "@/server/services/serializers";
import { updateAssessmentSchema } from "@/lib/validation";

type Params = { id: string };

export const GET = route<Params>(async (req, { params }) => {
  await requireStaff(req);
  const roster = await getAssessmentRoster(params.id);
  return { ...roster, rows: roster.rows.map((r) => ({ ...r, submission: r.submission && toPublicSubmission(r.submission) })) };
});

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireStaff(req);
  const input = await parseJson(req, updateAssessmentSchema);
  return updateAssessment(params.id, input, user.actor);
});
