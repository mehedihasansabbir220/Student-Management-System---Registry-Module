import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";

/** Server-side guard (middleware is only a convenience — this is the real check). */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user?.role !== "STAFF") redirect(user ? "/me" : "/");
  return <>{children}</>;
}
