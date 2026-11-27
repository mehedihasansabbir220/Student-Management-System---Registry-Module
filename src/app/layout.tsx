import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import "./globals.css";
import { NavLink } from "@/components/nav-link";
import { UserMenu } from "@/components/user-menu";
import { getCurrentUser } from "@/server/session";
import { logger } from "@/server/logger";
import { ROLE_LABEL, can, type Permission } from "@/domain/permissions";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Every page depends on the session cookie, so nothing is statically prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Registry · Student Management System", template: "%s · Registry" },
  description: "Student enrolment, fees, submissions and results for the Registry team.",
};

/** Staff navigation: each item appears only for roles holding its permission. */
const STAFF_NAV: { href: string; label: string; permission: Permission; exact?: boolean }[] = [
  { href: "/staff", label: "Dashboard", permission: "dashboard.read", exact: true },
  { href: "/staff/students", label: "Students", permission: "students.read" },
  { href: "/staff/assessments", label: "Assessments", permission: "submissions.read" },
  { href: "/staff/results", label: "Results", permission: "results.release" },
];

const STUDENT_NAV = [
  { href: "/me", label: "Overview", exact: true },
  { href: "/me/assessments", label: "Assessments" },
  { href: "/me/fees", label: "Fees" },
  { href: "/me/results", label: "Results" },
];

async function loadUser() {
  try {
    return { user: await getCurrentUser(), dbDown: false };
  } catch (err) {
    // Never swallow Next.js control-flow signals (redirect, notFound, dynamic usage).
    unstable_rethrow(err);
    // Keep the shell rendering even if the DB is down; pages show their own error.
    logger.error("layout: failed to load current user", { err });
    return { user: null, dbDown: true };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, dbDown } = await loadUser();
  const nav = !user ? [] : user.role === "STUDENT" ? STUDENT_NAV : STAFF_NAV.filter((n) => can(user.role, n.permission));

  return (
    // suppressHydrationWarning: browser extensions (e.g. Grammarly) inject attributes into <html>/<body>
    // before React hydrates. This only silences attribute diffs on these two elements, not their children.
    <html lang="en-GB" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans`} suppressHydrationWarning>
        <header className="bg-indigo-900 text-white shadow">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-white/15 text-sm">SMS</span>
                <span className="hidden sm:inline">Registry</span>
              </Link>
              <nav className="flex flex-wrap gap-1">
                {nav.map((n) => (
                  <NavLink key={n.href} href={n.href} exact={n.exact}>
                    {n.label}
                  </NavLink>
                ))}
              </nav>
            </div>
            {user && <UserMenu name={user.name} roleLabel={ROLE_LABEL[user.role]} isDemo={user.isDemo} />}
          </div>
        </header>
        {dbDown && (
          <div className="bg-rose-600 px-4 py-2 text-center text-sm text-white">The database is currently unavailable. Some information may not load.</div>
        )}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
