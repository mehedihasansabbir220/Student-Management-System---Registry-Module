import type { Metadata } from "next";
import { config } from "@/server/config";
import { safeNextPath } from "@/lib/safe-redirect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoGrid, LoginForm, type DemoAccount } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

/** Seeded demo accounts (prisma/seed-data.ts). Only shown when DEMO_MODE=true. */
const DEMO_ACCOUNTS: Omit<DemoAccount, "password">[] = [
  { role: "REGISTRY_ADMIN", label: "Registry Admin", description: "Full access: enrolment, finance, results release", email: "admin@demo.sms" },
  { role: "FINANCE", label: "Finance Officer", description: "Fees, payments, overdue balances", email: "finance@demo.sms" },
  { role: "ACADEMIC", label: "Academic Staff", description: "Assessments, submissions, marking", email: "academic@demo.sms" },
  { role: "STUDENT", label: "Student", description: "Amelia Clarke: coursework, fees, results", email: "amelia.clarke@student.example.ac.uk" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { demoMode, demoPassword } = config();
  const demoAccounts = demoMode ? DEMO_ACCOUNTS.map((a) => ({ ...a, password: demoPassword })) : [];

  return (
    <div className="grid w-full max-w-4xl gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>For Registry staff and students.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={safeNextPath(next, "")} />
        </CardContent>
      </Card>
      {demoMode && (
        <section aria-labelledby="demo-heading" className="space-y-3">
          <div>
            <h2 id="demo-heading" className="text-base font-semibold">Reviewing this project? Try a demo account</h2>
            <p className="text-sm text-muted-foreground">
              One click, no typing. The accounts are shared, so their passwords can&apos;t be changed and they can&apos;t be locked. Demo data resets nightly.
            </p>
          </div>
          <DemoGrid next={safeNextPath(next, "")} demoAccounts={demoAccounts} />
        </section>
      )}
    </div>
  );
}
