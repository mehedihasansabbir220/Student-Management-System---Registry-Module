import { redirect } from "next/navigation";
import { isStaff } from "@/domain/permissions";
import { loadShellUser } from "@/server/shell";
import { AppShell, DatabaseDown } from "@/components/shell/app-shell";

/** Server-side guard (middleware is only a convenience — this is the real check). */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, dbDown } = await loadShellUser();
  if (dbDown) return <DatabaseDown />;
  if (!user) redirect("/login");
  if (!isStaff(user.role)) redirect("/me");
  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role, isDemo: user.isDemo }} area="staff">
      {children}
    </AppShell>
  );
}
