import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { homeFor } from "@/domain/permissions";

export const dynamic = "force-dynamic";

/** "/" just routes: staff → dashboard, students → portal, everyone else → sign in. */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? homeFor(user.role) : "/login");
}
