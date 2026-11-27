import { route } from "@/server/http";
import { requireUser } from "@/server/session";
import { ForbiddenError } from "@/server/errors";
import { can } from "@/domain/permissions";
import { readSubmissionFile } from "@/server/services/submissions";

export const GET = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  // Students may download their own work (checked in the service); staff need submissions.read.
  if (user.role !== "STUDENT" && !can(user.role, "submissions.read")) throw new ForbiddenError("You don't have permission to do this");
  const viewer = user.role === "STUDENT" ? { role: "STUDENT" as const, studentId: user.studentId ?? "" } : { role: "STAFF" as const };
  const { bytes, fileName, mimeType } = await readSubmissionFile(params.id, viewer);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": mimeType,
      "content-length": String(bytes.length),
      // Always download, never render inline: uploaded content is untrusted.
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
});
