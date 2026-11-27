import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { BreadcrumbTitles } from "./breadcrumb-context";
import { TopBar } from "./top-bar";
import type { ShellArea, ShellUser } from "./types";

export async function AppShell({ user, area, children }: { user: ShellUser; area: ShellArea; children: ReactNode }) {
  // shadcn persists the collapsed/expanded state in this cookie.
  const open = (await cookies()).get("sidebar_state")?.value !== "false";
  return (
    <SidebarProvider defaultOpen={open}>
      <BreadcrumbTitles>
        <AppSidebar user={user} />
        <SidebarInset>
          <TopBar user={user} area={area} />
          <main className="mx-auto w-full max-w-7xl min-w-0 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </BreadcrumbTitles>
    </SidebarProvider>
  );
}

export function DatabaseDown() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div role="alert" className="max-w-md rounded-lg border border-destructive/30 bg-card p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">The database is currently unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your work is safe. Please try again in a moment. If this keeps happening, contact the Registry office.</p>
      </div>
    </div>
  );
}
