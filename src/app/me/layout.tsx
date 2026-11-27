import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/staff");
  return <>{children}</>;
}
