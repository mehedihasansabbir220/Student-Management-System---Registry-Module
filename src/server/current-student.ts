import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./session";

/** For student pages: the signed-in student (with their student record ids), or redirect. */
export async function currentStudentOrRedirect(): Promise<CurrentUser & { studentId: string; studentNumber: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT" || !user.studentId || !user.studentNumber) redirect("/staff");
  return user as CurrentUser & { studentId: string; studentNumber: string };
}
