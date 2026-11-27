"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, ClipboardList, GraduationCap, Home, LayoutDashboard, type LucideIcon, Receipt, Users } from "lucide-react";
import { isActive, navFor, type NavIcon } from "@/lib/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import type { ShellUser } from "./types";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  students: Users,
  assessments: ClipboardList,
  results: GraduationCap,
  home: Home,
  coursework: BookOpenCheck,
  fees: Receipt,
};

export function AppSidebar({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const groups = navFor(user.role);
  const home = groups[0]?.items[0]?.href ?? "/";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Registry">
              <Link href={home} onClick={() => setOpenMobile(false)}>
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">SMS</span>
                <span className="grid leading-tight">
                  <span className="font-semibold">Registry</span>
                  <span className="text-xs text-muted-foreground">Student Management</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = isActive(pathname, item);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link href={item.href} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
