import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import "./globals.css";
import { RoleSwitcher } from "@/components/role-switcher";
import { NavLink } from "@/components/nav-link";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";
import { logger } from "@/server/logger";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Every page depends on the session cookie, so nothing is statically prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Registry · Student Management System", template: "%s · Registry" },
  description: "Student enrolment, fees, submissions and results for the Registry team.",
};

async function loadHeader() {
  try {
    const [user, students] = await Promise.all([
      getCurrentUser(),
      db.student.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, studentNumber: true } }),
    ]);
    return { user, students, dbDown: false };
  } catch (err) {
    // Never swallow Next.js control-flow signals (redirect, notFound, dynamic usage).
    unstable_rethrow(err);
    // Keep the shell rendering even if the DB is down; pages show their own error.
    logger.error("layout: failed to load header data", { err });
    return { user: null, students: [], dbDown: true };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, students, dbDown } = await loadHeader();
  const current = !user ? "" : user.role === "STAFF" ? "STAFF" : user.studentId;

  return (
    <html lang="en-GB">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans`}>
        <header className="bg-indigo-900 text-white shadow">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-white/15 text-sm">SMS</span>
                <span className="hidden sm:inline">Registry</span>
              </Link>
              <nav className="flex flex-wrap gap-1">
                {user?.role === "STAFF" && (
                  <>
                    <NavLink href="/staff" exact>Dashboard</NavLink>
                    <NavLink href="/staff/students">Students</NavLink>
                    <NavLink href="/staff/assessments">Assessments</NavLink>
                    <NavLink href="/staff/results">Results</NavLink>
                  </>
                )}
                {user?.role === "STUDENT" && (
                  <>
                    <NavLink href="/me" exact>Overview</NavLink>
                    <NavLink href="/me/assessments">Assessments</NavLink>
                    <NavLink href="/me/fees">Fees</NavLink>
                    <NavLink href="/me/results">Results</NavLink>
                  </>
                )}
              </nav>
            </div>
            <RoleSwitcher current={current} students={students.map((s) => ({ id: s.id, label: `${s.fullName} (${s.studentNumber})` }))} />
          </div>
          {user && (
            <div className="border-t border-white/10 bg-indigo-950/40 text-xs text-indigo-100">
              <div className="mx-auto max-w-7xl px-4 py-1.5 sm:px-6">
                {user.role === "STAFF" ? "Signed in as Registry Administrator" : `Student view — ${user.fullName} (${user.studentNumber})`}
                <span className="ml-2 text-indigo-300">· Demo role toggle (no real authentication)</span>
              </div>
            </div>
          )}
        </header>
        {dbDown && (
          <div className="bg-rose-600 px-4 py-2 text-center text-sm text-white">The database is currently unavailable. Some information may not load.</div>
        )}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
