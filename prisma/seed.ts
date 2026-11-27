/**
 * `npm run db:seed` / `npx prisma db seed`
 * Runs with `--conditions=react-server` so the `server-only` guard used by the
 * service layer resolves to its no-op build outside Next.js.
 */
import { PrismaClient } from "@prisma/client";
import { runSeed } from "./seed-data";
import { formatGBP } from "@/domain/money";
import { getDashboard } from "@/server/services/dashboard";

async function main() {
  const db = new PrismaClient();
  try {
    const started = Date.now();
    const { students } = await runSeed(db);
    const d = await getDashboard();
    console.log(`\n✔ Seeded in ${Date.now() - started}ms\n`);
    console.table(
      Object.values(students).map((s) => ({ id: s.studentNumber, name: s.fullName })),
    );
    console.log(
      `Overdue: ${d.overdue.length} (${formatGBP(d.overdueTotalPence)}) · Late submissions: ${d.lateSubmissions.length} · ` +
        `Awaiting release: ${d.awaitingRelease.length} · Credit held: ${formatGBP(d.finance.creditPence)}\n`,
    );
    console.log("Demo sign-in (password = DEMO_PASSWORD, default Demo@12345):");
    console.table([
      { role: "Registry Admin", email: "admin@demo.sms" },
      { role: "Finance Officer", email: "finance@demo.sms" },
      { role: "Academic Staff", email: "academic@demo.sms" },
      { role: "Student", email: "amelia.clarke@student.example.ac.uk" },
    ]);
    console.log("James Wilson's account is left 'invitation pending' to demo the activation flow.\n");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("✘ Seed failed:", err);
  process.exit(1);
});
