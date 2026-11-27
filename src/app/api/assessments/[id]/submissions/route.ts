import { config } from "@/server/config";
import { PayloadTooLargeError, ValidationError } from "@/server/errors";
import { created, route } from "@/server/http";
import { requireStudent } from "@/server/session";
import { submitAssessment } from "@/server/services/submissions";
import { toPublicSubmission } from "@/server/services/serializers";

/** Multipart upload, field "file". Size is checked from Content-Length before buffering when possible. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireStudent(req);
  const { maxUploadBytes, maxUploadMb } = config();
  const tooLarge = () => new PayloadTooLargeError(`Files must be ${maxUploadMb} MB or smaller`);

  // Headroom for multipart boundaries and part headers.
  if (Number(req.headers.get("content-length") ?? 0) > maxUploadBytes + 64 * 1024) throw tooLarge();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ValidationError("Upload must be multipart/form-data with a 'file' field", { file: "Choose a file to upload" });
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ValidationError("No file was uploaded", { file: "Choose a file to upload" });
  if (file.size > maxUploadBytes) throw tooLarge();

  const submission = await submitAssessment({
    assessmentId: params.id,
    studentId: user.studentId,
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    actor: user.actor,
  });
  return created(toPublicSubmission(submission));
});
