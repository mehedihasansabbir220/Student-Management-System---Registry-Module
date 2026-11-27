"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { ROLE_LABEL } from "@/domain/permissions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/initials";
import type { ShellUser } from "./types";

export function UserMenu({ user, accountHref }: { user: ShellUser; accountHref: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Even if the network call failed, leave the signed-in UI.
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Badge variant="secondary">{ROLE_LABEL[user.role]}</Badge>
            {user.isDemo && <Badge variant="outline">Demo account</Badge>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={accountHref}><UserRound /> Account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut} disabled={pending}>
          <LogOut /> {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
