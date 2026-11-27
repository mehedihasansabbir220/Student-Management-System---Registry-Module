/**
 * Every protected route × every role. The table below IS the access policy:
 * if a route's guard drifts from it, this test fails.
 */
import { beforeEach, describe, expect, it } from "vitest";
import * as dashboard from "@/app/api/dashboard/route";
import * as programmes from "@/app/api/programmes/route";
import * as modules from "@/app/api/modules/route";
import * as students from "@/app/api/students/route";
import * as student from "@/app/api/students/[id]/route";
import * as fees from "@/app/api/students/[id]/fees/route";
import * as payments from "@/app/api/students/[id]/payments/route";
import * as voidPayment from "@/app/api/payments/[id]/void/route";
import * as results from "@/app/api/students/[id]/results/route";
import * as publish from "@/app/api/students/[id]/results/publish/route";
import * as withhold from "@/app/api/students/[id]/results/withhold/route";
import * as assessments from "@/app/api/assessments/route";
import * as assessment from "@/app/api/assessments/[id]/route";
import * as uploads from "@/app/api/assessments/[id]/submissions/route";
import * as file from "@/app/api/submissions/[id]/file/route";
import * as grades from "@/app/api/grades/route";
import * as meResults from "@/app/api/me/results/route";
import * as meFees from "@/app/api/me/fees/route";
import * as meAssessments from "@/app/api/me/assessments/route";
import { can, type Permission, type Role } from "@/domain/permissions";
import { db } from "@/server/db";
import { submitAssessment } from "@/server/services/submissions";
import { makeAssessment, makeModule, makeProgramme, makeStudent } from "../support/factories";
import { call, type As } from "../support/http";

type Fixture = { studentId: string; assessmentId: string; paymentId: string; submissionId: string };
let fx: Fixture;

beforeEach(async () => {
  const p = await makeProgramme();
  const m = await makeModule(p.id);
  const a = await makeAssessment(m.id, new Date(Date.now() + 86_400_000));
  const s = await makeStudent(p.id);
  const pay = await db.payment.create({ data: { studentId: s.id, amount: "10.00", paidOn: new Date("2025-01-01"), reference: `R-${Date.now()}` } });
  const sub = await submitAssessment({ assessmentId: a.id, studentId: s.id, fileName: "x.pdf", bytes: new TextEncoder().encode("%PDF-1.7 x"), actor: "t" });
  fx = { studentId: s.id, assessmentId: a.id, paymentId: pay.id, submissionId: sub.id };
});

type Row = { name: string; handler: unknown; permission: Permission; opts: (f: Fixture) => Parameters<typeof call>[1] };

const MATRIX: Row[] = [
  { name: "GET /api/dashboard", handler: dashboard.GET, permission: "dashboard.read", opts: () => ({}) },
  { name: "GET /api/programmes", handler: programmes.GET, permission: "students.read", opts: () => ({}) },
  { name: "GET /api/modules", handler: modules.GET, permission: "students.read", opts: () => ({}) },
  { name: "GET /api/students", handler: students.GET, permission: "students.read", opts: () => ({}) },
  { name: "POST /api/students", handler: students.POST, permission: "students.write", opts: () => ({ method: "POST", json: {} }) },
  { name: "GET /api/students/:id", handler: student.GET, permission: "students.read", opts: (f) => ({ params: { id: f.studentId } }) },
  { name: "PATCH /api/students/:id", handler: student.PATCH, permission: "students.write", opts: (f) => ({ method: "PATCH", params: { id: f.studentId }, json: {} }) },
  { name: "GET /api/students/:id/fees", handler: fees.GET, permission: "finance.read", opts: (f) => ({ params: { id: f.studentId } }) },
  { name: "POST /api/students/:id/fees", handler: fees.POST, permission: "fees.write", opts: (f) => ({ method: "POST", params: { id: f.studentId }, json: {} }) },
  { name: "POST /api/students/:id/payments", handler: payments.POST, permission: "payments.write", opts: (f) => ({ method: "POST", params: { id: f.studentId }, json: {} }) },
  { name: "POST /api/payments/:id/void", handler: voidPayment.POST, permission: "payments.void", opts: (f) => ({ method: "POST", params: { id: f.paymentId }, json: {} }) },
  { name: "GET /api/students/:id/results", handler: results.GET, permission: "results.read", opts: (f) => ({ params: { id: f.studentId } }) },
  { name: "POST /api/students/:id/results/publish", handler: publish.POST, permission: "results.release", opts: (f) => ({ method: "POST", params: { id: f.studentId } }) },
  { name: "POST /api/students/:id/results/withhold", handler: withhold.POST, permission: "results.release", opts: (f) => ({ method: "POST", params: { id: f.studentId }, json: {} }) },
  { name: "GET /api/assessments (staff)", handler: assessments.GET, permission: "submissions.read", opts: () => ({}) },
  { name: "POST /api/assessments", handler: assessments.POST, permission: "assessments.write", opts: () => ({ method: "POST", json: {} }) },
  { name: "GET /api/assessments/:id", handler: assessment.GET, permission: "submissions.read", opts: (f) => ({ params: { id: f.assessmentId } }) },
  { name: "PATCH /api/assessments/:id", handler: assessment.PATCH, permission: "assessments.write", opts: (f) => ({ method: "PATCH", params: { id: f.assessmentId }, json: {} }) },
  { name: "PUT /api/grades", handler: grades.PUT, permission: "grades.write", opts: () => ({ method: "PUT", json: {} }) },
  { name: "GET /api/submissions/:id/file (staff)", handler: file.GET, permission: "submissions.read", opts: (f) => ({ params: { id: f.submissionId } }) },
];

const STAFF: [Role, As][] = [
  ["REGISTRY_ADMIN", "admin"],
  ["FINANCE", "finance"],
  ["ACADEMIC", "academic"],
];

describe("staff routes × staff roles", () => {
  for (const row of MATRIX) {
    for (const [role, as] of STAFF) {
      const allowed = can(role, row.permission);
      it(`${row.name} as ${role} → ${allowed ? "allowed" : "403"}`, async () => {
        const res = await call(row.handler, { ...row.opts(fx), as });
        if (allowed) expect([401, 403]).not.toContain(res.status);
        else expect(res.status).toBe(403);
      });
    }
  }
});

describe("students on staff routes", () => {
  const studentOnlyAllowed = new Set(["GET /api/assessments (staff)", "GET /api/submissions/:id/file (staff)"]);
  for (const row of MATRIX.filter((r) => !studentOnlyAllowed.has(r.name))) {
    it(`${row.name} as STUDENT → 403`, async () => {
      expect((await call(row.handler, { ...row.opts(fx), as: { studentId: fx.studentId } })).status).toBe(403);
    });
  }
});

describe("student-only routes", () => {
  const rows: [string, unknown, (f: Fixture) => Parameters<typeof call>[1]][] = [
    ["GET /api/me/results", meResults.GET, () => ({})],
    ["GET /api/me/fees", meFees.GET, () => ({})],
    ["GET /api/me/assessments", meAssessments.GET, () => ({})],
    ["POST /api/assessments/:id/submissions", uploads.POST, (f) => ({ method: "POST", params: { id: f.assessmentId }, body: new FormData() })],
  ];
  for (const [name, handler, opts] of rows) {
    for (const [role, as] of STAFF) {
      it(`${name} as ${role} → 403`, async () => {
        expect((await call(handler, { ...opts(fx), as })).status).toBe(403);
      });
    }
    it(`${name} as the student → allowed`, async () => {
      expect([401, 403]).not.toContain((await call(handler, { ...opts(fx), as: { studentId: fx.studentId } })).status);
    });
  }
});
