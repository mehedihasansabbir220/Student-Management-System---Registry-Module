import { route } from "@/server/http";
import { requireUser } from "@/server/session";

export const GET = route(async (req) => {
  const u = await requireUser(req);
  return {
    user: { id: u.userId, email: u.email, name: u.name, role: u.role, studentId: u.studentId, studentNumber: u.studentNumber, isDemo: u.isDemo },
  };
});
