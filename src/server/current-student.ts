import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";

/** For student pages: the signed-in student, or redirect. */
export async function currentStudentOrRedirect() {
  const user = await getCurrentUser();
  if (user?.role !== "STUDENT") redirect("/");
  return user;
}
