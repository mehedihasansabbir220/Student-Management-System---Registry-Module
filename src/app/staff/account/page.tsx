import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { AccountPage } from "@/components/account/account-page";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <AccountPage user={{ name: user.name, email: user.email, role: user.role, isDemo: user.isDemo }} />;
}
