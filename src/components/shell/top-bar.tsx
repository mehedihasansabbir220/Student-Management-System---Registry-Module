"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { breadcrumbsFor } from "@/lib/breadcrumbs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useBreadcrumbTitles } from "./breadcrumb-context";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import type { ShellArea, ShellUser } from "./types";

export function TopBar({ user, area }: { user: ShellUser; area: ShellArea }) {
  const crumbs = breadcrumbsFor(usePathname(), useBreadcrumbTitles());
  return (
    <header data-print-hide className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:px-4">
      <SidebarTrigger aria-label="Toggle navigation" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((c, i) => (
            <Fragment key={`${i}-${c.label}`}>
              {i > 0 && <BreadcrumbSeparator className={i < crumbs.length - 1 ? "hidden md:block" : undefined} />}
              <BreadcrumbItem className={i < crumbs.length - 1 ? "hidden md:inline-flex" : "min-w-0"}>
                {c.href ? (
                  <BreadcrumbLink asChild><Link href={c.href}>{c.label}</Link></BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu user={user} accountHref={area === "staff" ? "/staff/account" : "/me/account"} />
      </div>
    </header>
  );
}
