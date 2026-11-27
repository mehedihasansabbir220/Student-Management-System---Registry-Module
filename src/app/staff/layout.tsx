import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { isStaff } from "@/domain/permissions";

/** Server-side guard (middleware is only a convenience — this is the real check). */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaff(user.role)) redirect("/me");
  return <>{children}</>;
}
