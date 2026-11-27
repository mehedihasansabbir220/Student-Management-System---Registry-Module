import { route } from "@/server/http";
import { requireUser } from "@/server/session";
import { readSubmissionFile } from "@/server/services/submissions";

export const GET = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const viewer = user.role === "STAFF" ? { role: "STAFF" as const } : { role: "STUDENT" as const, studentId: user.studentId };
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
