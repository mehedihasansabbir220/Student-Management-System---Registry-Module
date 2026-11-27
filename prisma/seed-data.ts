/**
 * Demo data for reviewers. Every row is created through the real service
 * layer, so seeded data obeys the same rules as data entered in the UI
 * (ID generation, fee snapshots, lateness, audit trail).
 *
 * All dates are relative to `today`, so "overdue" and "late" look right
 * whenever the seed is run. See README → "Demo data" for who demonstrates what.
 */
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { config } from "@/server/config";
import { createStudent, updateStudent } from "@/server/services/students";
import { recordPayment, voidPayment } from "@/server/services/fees";
import { submitAssessment } from "@/server/services/submissions";
import { enterGrade, publishResults, withholdResults } from "@/server/services/results";
import { createAssessment } from "@/server/services/assessments";
import { issueActivationLink } from "@/server/services/auth";
import { hashPassword } from "@/server/auth/password";

const ACTOR = "seed:registry-admin";
const DAY = 86_400_000;

/** A small but valid single-page PDF, so downloaded demo submissions actually open. */
export function makePdf(text: string): Uint8Array {
  const safe = text.replace(/[()\\]/g, "");
  const stream = `BT /F1 18 Tf 72 720 Td (${safe}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

async function resetAll(db: PrismaClient) {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
  // Clear previously seeded files — but only if UPLOAD_DIR is inside the project (never rm outside it).
  const dir = config().uploadDir;
  if (dir.startsWith(process.cwd() + path.sep)) {
    const entries = await readdir(dir).catch(() => []);
    await Promise.all(entries.map((e) => rm(path.join(dir, e), { recursive: true, force: true })));
  }
}

export async function runSeed(db: PrismaClient, today = new Date()) {
  await resetAll(db);
  const at = (days: number, hour = 17) => {
    const d = new Date(today.getTime() + days * DAY);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };
  const dateOnly = (days: number) => {
    const d = new Date(today.getTime() + days * DAY);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  };

  // ---- Programmes & modules -------------------------------------------------
  const cs = await db.programme.create({ data: { code: "BSC-CS", name: "BSc (Hons) Computer Science", feeAmount: "9250.00" } });
  const bus = await db.programme.create({ data: { code: "BA-BUS", name: "BA (Hons) Business Management", feeAmount: "8500.00" } });
  const [cs101, cs102, bus101, bus102] = await Promise.all([
    db.module.create({ data: { code: "CS101", title: "Programming Fundamentals", programmeId: cs.id } }),
    db.module.create({ data: { code: "CS102", title: "Database Systems", programmeId: cs.id } }),
    db.module.create({ data: { code: "BUS101", title: "Principles of Management", programmeId: bus.id } }),
    db.module.create({ data: { code: "BUS102", title: "Financial Accounting", programmeId: bus.id } }),
  ]);

  // ---- Students (enrolment date drives the fee due date: enrolled + 30 days) ---
  const enrol = (fullName: string, email: string, programmeId: string, enrolledDaysAgo: number, academicYear = "2025/26", dob = "2005-04-12") =>
    createStudent(
      { fullName, email, programmeId, academicYear, dateOfBirth: new Date(`${dob}T00:00:00Z`), status: "ENROLLED" },
      ACTOR,
      new Date(today.getTime() - enrolledDaysAgo * DAY),
    );

  const amelia = await enrol("Amelia Clarke", "amelia.clarke@student.example.ac.uk", cs.id, 60, "2025/26", "2004-09-03");
  const oliver = await enrol("Oliver Bennett", "oliver.bennett@student.example.ac.uk", cs.id, 60, "2025/26", "2005-01-21");
  const priya = await enrol("Priya Sharma", "priya.sharma@student.example.ac.uk", cs.id, 5, "2025/26", "2006-02-14");
  const daniel = await enrol("Daniel Okafor", "daniel.okafor@student.example.ac.uk", bus.id, 90, "2025/26", "2003-11-30");
  const sophie = await enrol("Sophie Martin", "sophie.martin@student.example.ac.uk", bus.id, 45, "2025/26", "2005-06-08");
  const james = await enrol("James Wilson", "james.wilson@student.example.ac.uk", cs.id, 10, "2025/26", "2004-12-01");
  const hannah = await enrol("Hannah Lee", "hannah.lee@student.example.ac.uk", bus.id, 120, "2025/26", "2005-03-17");
  const ethan = await enrol("Ethan Hughes", "ethan.hughes@student.example.ac.uk", cs.id, 400, "2024/25", "2003-07-25");

  // ---- Payments ---------------------------------------------------------------
  const pay = (studentId: string, amount: string, daysAgo: number, reference: string, method: "BANK_TRANSFER" | "CARD" | "SPONSOR" = "BANK_TRANSFER") =>
    recordPayment(studentId, { amount, paidOn: dateOnly(-daysAgo), reference, method }, ACTOR, today);

  await pay(amelia.id, "9250.00", 40, "BACS-260101-AC");                 // paid in full
  await pay(oliver.id, "3000.00", 35, "CARD-260115-OB", "CARD");         // part paid → overdue
  const bounced = await pay(oliver.id, "1000.00", 20, "CHQ-260130-OB");
  await voidPayment(bounced.payment.id, "Cheque returned unpaid by bank", ACTOR); // voided → excluded
  await pay(priya.id, "2000.00", 2, "BACS-260310-PS");                   // part paid, not yet due
  await pay(sophie.id, "8500.00", 30, "SLC-260201-SM", "SPONSOR");       // Student Finance
  await pay(sophie.id, "250.00", 10, "CARD-260305-SM", "CARD");          // overpaid → £250 credit
  await pay(hannah.id, "1000.00", 100, "BACS-251201-HL");                // withdrew owing money
  await pay(ethan.id, "9250.00", 380, "SLC-241001-EH", "SPONSOR");       // completed, paid
  // Daniel and James: nothing paid (Daniel overdue, James not yet due)

  // ---- Assessments ------------------------------------------------------------
  const portfolio = await createAssessment({ title: "Programming Portfolio", moduleId: cs101.id, deadline: at(-10) }, ACTOR);
  const dbReport = await createAssessment({ title: "Database Design Report", moduleId: cs102.id, deadline: at(1) }, ACTOR);
  await createAssessment({ title: "Final Project Proposal", moduleId: cs101.id, deadline: at(21) }, ACTOR);
  const caseStudy = await createAssessment({ title: "Management Case Study", moduleId: bus101.id, deadline: at(-7) }, ACTOR);
  await createAssessment({ title: "Accounting Exam Paper", moduleId: bus102.id, deadline: at(5) }, ACTOR);

  // ---- Submissions (`now` = when the student uploaded) -------------------------
  const submit = (assessmentId: string, studentId: string, days: number, name: string, label: string) =>
    submitAssessment({ assessmentId, studentId, fileName: name, bytes: makePdf(label), actor: `student:seed`, now: at(days, 12) });

  await submit(portfolio.id, amelia.id, -12, "amelia-portfolio.pdf", "Amelia Clarke - Programming Portfolio");
  await submit(portfolio.id, oliver.id, -9, "portfolio_final.pdf", "Oliver Bennett - Programming Portfolio (late)");
  await submit(portfolio.id, priya.id, -14, "portfolio-draft.pdf", "Priya Sharma - Portfolio draft");
  await submit(portfolio.id, priya.id, -11, "portfolio-v2.pdf", "Priya Sharma - Portfolio v2");   // resubmission → version 2
  await submit(portfolio.id, ethan.id, -15, "ethan-portfolio.pdf", "Ethan Hughes - Programming Portfolio");
  await submit(dbReport.id, priya.id, -1, "db-report.pdf", "Priya Sharma - Database Design Report");
  await submit(caseStudy.id, sophie.id, -8, "case-study.pdf", "Sophie Martin - Management Case Study");
  await submit(caseStudy.id, daniel.id, -6, "case_study_okafor.pdf", "Daniel Okafor - Case Study (late)");
  // Missing: Amelia & Oliver for the DB report (due tomorrow); Hannah for the case study.

  // ---- Grades (covering every classification boundary) ------------------------
  const grade = (assessmentId: string, studentId: string, mark: number) => enterGrade({ assessmentId, studentId, mark }, ACTOR);
  await grade(portfolio.id, amelia.id, 72);  // Distinction
  await grade(portfolio.id, ethan.id, 70);   // Distinction (boundary)
  await grade(portfolio.id, priya.id, 60);   // Merit (boundary)
  await grade(portfolio.id, oliver.id, 40);  // Pass (boundary)
  await grade(caseStudy.id, sophie.id, 82);  // Distinction
  await grade(caseStudy.id, daniel.id, 35);  // Fail

  // ---- Result release decisions --------------------------------------------------
  await publishResults(amelia.id, ACTOR);
  await publishResults(sophie.id, ACTOR);
  await publishResults(ethan.id, ACTOR);
  await withholdResults(oliver.id, { reason: "Outstanding tuition fees", shareReason: true }, ACTOR);
  await withholdResults(daniel.id, { reason: "Pending moderation by external examiner", shareReason: false }, ACTOR);
  // Priya: graded but never released → shows under "awaiting release".

  // ---- Status changes after the fact (keeps their history realistic) -------------
  await updateStudent(ethan.id, { status: "COMPLETED" }, ACTOR);
  await updateStudent(james.id, { status: "DEFERRED" }, ACTOR);
  await updateStudent(hannah.id, { status: "WITHDRAWN" }, ACTOR);

  // ---- Demo accounts (design §5.7 / §5.10) ---------------------------------------
  // Every seeded account is a protected, shared demo account (no lockout, no password change).
  const demoHash = await hashPassword(config().demoPassword);
  await db.user.createMany({
    data: [
      { email: "admin@demo.sms", name: "Rachel Adams", role: "REGISTRY_ADMIN", passwordHash: demoHash, isDemo: true },
      { email: "finance@demo.sms", name: "Farid Khan", role: "FINANCE", passwordHash: demoHash, isDemo: true },
      { email: "academic@demo.sms", name: "Dr. Alice Moreno", role: "ACADEMIC", passwordHash: demoHash, isDemo: true },
    ],
  });
  // Student accounts were created (pending) at enrolment. Activate all but James, who shows the invitation flow.
  await db.user.updateMany({ where: { role: "STUDENT", NOT: { studentId: james.id } }, data: { passwordHash: demoHash, isDemo: true } });
  await db.user.updateMany({ where: { studentId: james.id }, data: { isDemo: true } });
  await db.activationToken.deleteMany({ where: { user: { passwordHash: { not: null } } } });
  // His enrolment-time link has expired by now (enrolled 10 days ago); issue a fresh one.
  await issueActivationLink(james.id, ACTOR);

  return {
    students: { amelia, oliver, priya, daniel, sophie, james, hannah, ethan },
    programmes: { cs, bus },
  };
}
