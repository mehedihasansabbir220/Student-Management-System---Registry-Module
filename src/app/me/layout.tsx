import { redirect } from "next/navigation";
import { loadShellUser } from "@/server/shell";
import { AppShell, DatabaseDown } from "@/components/shell/app-shell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, dbDown } = await loadShellUser();
  if (dbDown) return <DatabaseDown />;
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/staff");
  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role, isDemo: user.isDemo }} area="student">
      {children}
    </AppShell>
  );
}
