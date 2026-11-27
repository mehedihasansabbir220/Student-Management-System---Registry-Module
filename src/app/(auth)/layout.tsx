import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/shell/theme-toggle";

/** Signed-out pages (sign in, account activation): centred, no app shell. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">SMS</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">Registry</span>
            <span className="block text-xs text-muted-foreground">Student Management System</span>
          </span>
        </div>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 md:items-center md:pt-0">{children}</main>
    </div>
  );
}
