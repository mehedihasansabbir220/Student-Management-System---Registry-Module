import type { Metadata } from "next";
import { config } from "@/server/config";
import { safeNextPath } from "@/lib/safe-redirect";
import { LoginForm, type DemoAccount } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

/** Seeded demo accounts (prisma/seed-data.ts). Only shown when DEMO_MODE=true. */
const DEMO_ACCOUNTS: Omit<DemoAccount, "password">[] = [
  { label: "Registry Admin", description: "Full access: enrolment, finance, results release", email: "admin@demo.sms" },
  { label: "Finance Officer", description: "Fees, payments, overdue reminders", email: "finance@demo.sms" },
  { label: "Academic Staff", description: "Assessments, submissions, marking", email: "academic@demo.sms" },
  { label: "Student", description: "Amelia Clarke: coursework, fees, results", email: "amelia.clarke@student.example.ac.uk" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { demoMode, demoPassword } = config();

  return (
    <div className="mx-auto grid max-w-4xl gap-8 py-6 md:grid-cols-2">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Registry</h1>
        <p className="mt-1 text-sm text-slate-500">Student Management System for staff and students.</p>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm next={safeNextPath(next, "")} demoAccounts={demoMode ? DEMO_ACCOUNTS.map((a) => ({ ...a, password: demoPassword })) : []} />
        </div>
      </div>
      {demoMode && (
        <aside className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-6 text-sm text-indigo-950">
          <h2 className="font-semibold">Reviewing this project?</h2>
          <p className="mt-2 text-indigo-900/80">
            Use a <strong>demo account</strong> to explore each role. They&apos;re shared, so passwords can&apos;t be changed and the accounts can&apos;t be locked.
          </p>
          <p className="mt-2 text-indigo-900/80">Demo data resets nightly.</p>
        </aside>
      )}
    </div>
  );
}
