import { route } from "@/server/http";
import { requirePermission } from "@/server/session";
import { issueActivationLink } from "@/server/services/auth";

/**
 * Issue a fresh activation link for a student who hasn't activated their account.
 * There's no email system (design §5.6), so staff copy the link and pass it on.
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, "students.write");
  const token = await issueActivationLink(params.id, user.actor);
  const url = new URL("/activate", req.nextUrl.origin);
  url.searchParams.set("token", token);
  return { url: url.toString() };
});
