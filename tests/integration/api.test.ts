import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import * as health from "@/app/api/health/route";
import * as session from "@/app/api/session/route";
import * as students from "@/app/api/students/route";
import * as student from "@/app/api/students/[id]/route";
import * as payments from "@/app/api/students/[id]/payments/route";
import * as voidPayment from "@/app/api/payments/[id]/void/route";
import * as publish from "@/app/api/students/[id]/results/publish/route";
import * as withhold from "@/app/api/students/[id]/results/withhold/route";
import * as assessments from "@/app/api/assessments/route";
import * as uploads from "@/app/api/assessments/[id]/submissions/route";
import * as file from "@/app/api/submissions/[id]/file/route";
import * as grades from "@/app/api/grades/route";
import * as myResults from "@/app/api/me/results/route";
import * as dashboard from "@/app/api/dashboard/route";
import { makeAssessment, makeModule, makeProgramme, makeStudent } from "../support/factories";
import { call } from "../support/http";

const studentBody = (programmeId: string, overrides: Record<string, unknown> = {}) => ({
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  dateOfBirth: "2004-05-10",
  programmeId,
  academicYear: "2025/26",
  ...overrides,
});

const pdfForm = (name = "essay.pdf", content = "%PDF-1.7 hello") => {
  const form = new FormData();
  form.set("file", new File([content], name, { type: "application/pdf" }));
  return form;
};

describe("GET /api/health", () => {
  it("reports database connectivity", async () => {
    const res = await call(health.GET, { as: "none" });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ status: "ok", database: "up" });
  });
});

describe("POST /api/session (role toggle)", () => {
  it("sets the session cookie for staff", async () => {
    const res = await call(session.POST, { method: "POST", as: "none", json: { role: "STAFF" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("sms_session=");
  });

  it("rejects acting as a student that does not exist", async () => {
    const res = await call(session.POST, { method: "POST", as: "none", json: { role: "STUDENT", studentId: "ghost" } });
    expect(res.status).toBe(404);
  });
});

describe("authorisation", () => {
  it("returns 401 with no session", async () => {
    const res = await call(students.GET, { as: "none" });
    expect(res.status).toBe(401);
    expect(res.data.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 when a student calls a staff endpoint", async () => {
    const p = await makeProgramme();
    const s = await makeStudent(p.id);
    for (const [handler, opts] of [
      [students.GET, {}],
      [students.POST, { method: "POST", json: studentBody(p.id) }],
      [grades.PUT, { method: "PUT", json: { assessmentId: "x", studentId: s.id, mark: 100 } }],
      [publish.POST, { method: "POST", params: { id: s.id } }],
      [dashboard.GET, {}],
    ] as const) {
      const res = await call(handler, { ...opts, as: { studentId: s.id } });
      expect(res.status).toBe(403);
    }
  });

  it("returns 403 when staff call a student-only endpoint", async () => {
    const res = await call(myResults.GET, { as: "staff" });
    expect(res.status).toBe(403);
  });
});

describe("students API", () => {
  it("creates a student (201) with a generated ID", async () => {
    const p = await makeProgramme();
    const res = await call(students.POST, { method: "POST", json: studentBody(p.id) });
    expect(res.status).toBe(201);
    expect(res.data.studentNumber).toBe("SMS-2025-0001");
  });

  it("returns 400 with field errors for invalid input", async () => {
    const p = await makeProgramme();
    const res = await call(students.POST, { method: "POST", json: studentBody(p.id, { email: "bad", dateOfBirth: "2099-01-01" }) });
    expect(res.status).toBe(400);
    expect(Object.keys(res.data.error.fields)).toEqual(expect.arrayContaining(["email", "dateOfBirth"]));
    expect(res.data.error.requestId).toBeTruthy();
  });

  it("returns 400 (not 500) for malformed JSON", async () => {
    const res = await call(students.POST, { method: "POST", body: "{not json" });
    expect(res.status).toBe(400);
  });

  it("returns 409 for a duplicate email", async () => {
    const p = await makeProgramme();
    await call(students.POST, { method: "POST", json: studentBody(p.id) });
    const res = await call(students.POST, { method: "POST", json: studentBody(p.id, { email: "ADA@example.com" }) });
    expect(res.status).toBe(409);
    expect(res.data.error.fields).toHaveProperty("email");
  });

  it("searches via query string", async () => {
    const p = await makeProgramme();
    await makeStudent(p.id, { fullName: "Grace Hopper" });
    await makeStudent(p.id, { fullName: "Alan Turing" });
    const res = await call(students.GET, { url: "http://localhost/api/students?q=grace" });
    expect(res.data.items.map((s: { fullName: string }) => s.fullName)).toEqual(["Grace Hopper"]);
  });

  it("returns 400 for an invalid status filter", async () => {
    const res = await call(students.GET, { url: "http://localhost/api/students?status=NOPE" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown student", async () => {
    const res = await call(student.GET, { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });

  it("serialises money as strings/pence, not floats", async () => {
    const p = await makeProgramme({ feeAmount: "9250.00" });
    const created = await call(students.POST, { method: "POST", json: studentBody(p.id) });
    const res = await call(student.GET, { params: { id: created.data.id } });
    expect(res.data.account.balancePence).toBe(925000);
    expect(res.data.fees[0].amount).toBe("9250");
  });
});

describe("payments API", () => {
  it("records a payment and returns the new balance; duplicate reference → 409", async () => {
    const p = await makeProgramme({ feeAmount: "1000.00" });
    const created = await call(students.POST, { method: "POST", json: studentBody(p.id) });
    const body = { amount: "250", paidOn: "2025-01-01", reference: "bacs-1" };
    const ok = await call(payments.POST, { method: "POST", params: { id: created.data.id }, json: body });
    expect(ok.status).toBe(201);
    expect(ok.data.account.balancePence).toBe(75000);
    const dup = await call(payments.POST, { method: "POST", params: { id: created.data.id }, json: body });
    expect(dup.status).toBe(409);
  });

  it("voiding twice returns 422", async () => {
    const p = await makeProgramme();
    const created = await call(students.POST, { method: "POST", json: studentBody(p.id) });
    const ok = await call(payments.POST, { method: "POST", params: { id: created.data.id }, json: { amount: "10", paidOn: "2025-01-01", reference: "R" } });
    const first = await call(voidPayment.POST, { method: "POST", params: { id: ok.data.payment.id }, json: { reason: "Bounced" } });
    expect(first.status).toBe(200);
    const second = await call(voidPayment.POST, { method: "POST", params: { id: ok.data.payment.id }, json: { reason: "Bounced" } });
    expect(second.status).toBe(422);
  });
});

describe("assessments & submissions API", () => {
  async function setup(deadline = new Date(Date.now() + 86_400_000)) {
    const p = await makeProgramme();
    const m = await makeModule(p.id);
    const a = await makeAssessment(m.id, deadline);
    const s = await makeStudent(p.id);
    return { p, m, a, s };
  }

  it("staff create assessments (201); bad deadline → 400", async () => {
    const { m } = await setup();
    const ok = await call(assessments.POST, { method: "POST", json: { title: "Essay 2", moduleId: m.id, deadline: "2030-01-01T17:00:00Z" } });
    expect(ok.status).toBe(201);
    const bad = await call(assessments.POST, { method: "POST", json: { title: "Essay 2", moduleId: m.id, deadline: "tomorrow-ish" } });
    expect(bad.status).toBe(400);
  });

  it("students only see their programme's assessments", async () => {
    const { s } = await setup();
    await setup(); // another programme
    const res = await call(assessments.GET, { as: { studentId: s.id } });
    expect(res.data.items).toHaveLength(1);
  });

  it("student uploads a PDF (201) via multipart", async () => {
    const { a, s } = await setup();
    const res = await call(uploads.POST, { method: "POST", as: { studentId: s.id }, params: { id: a.id }, body: pdfForm() });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ isLate: false, version: 1, originalName: "essay.pdf" });
    expect(res.data.storageKey).toBeUndefined();
  });

  it("late upload is accepted and flagged; resubmission after deadline → 422", async () => {
    const { a, s } = await setup(new Date(Date.now() - 3_600_000));
    const late = await call(uploads.POST, { method: "POST", as: { studentId: s.id }, params: { id: a.id }, body: pdfForm() });
    expect(late.status).toBe(201);
    expect(late.data.isLate).toBe(true);
    const again = await call(uploads.POST, { method: "POST", as: { studentId: s.id }, params: { id: a.id }, body: pdfForm() });
    expect(again.status).toBe(422);
  });

  it("wrong file type → 415; missing file → 400", async () => {
    const { a, s } = await setup();
    const png = new FormData();
    png.set("file", new File(["\x89PNG"], "pic.png", { type: "image/png" }));
    expect((await call(uploads.POST, { method: "POST", as: { studentId: s.id }, params: { id: a.id }, body: png })).status).toBe(415);
    expect((await call(uploads.POST, { method: "POST", as: { studentId: s.id }, params: { id: a.id }, body: new FormData() })).status).toBe(400);
  });

  it("download: owner 200 with attachment headers, other student 403", async () => {
    const { p, a, s } = await setup();
    const up = await call(uploads.POST, { method: "POST", as: { studentId: s.id }, params: { id: a.id }, body: pdfForm("my essay.pdf") });
    const mine = await call(file.GET, { as: { studentId: s.id }, params: { id: up.data.id } });
    expect(mine.status).toBe(200);
    expect(mine.headers.get("content-type")).toBe("application/pdf");
    expect(mine.headers.get("content-disposition")).toContain("attachment");
    expect(mine.headers.get("x-content-type-options")).toBe("nosniff");
    const other = await makeStudent(p.id);
    expect((await call(file.GET, { as: { studentId: other.id }, params: { id: up.data.id } })).status).toBe(403);
  });
});

describe("grades & results API", () => {
  it("staff grade, publish; the student only sees marks after publication", async () => {
    const p = await makeProgramme();
    const m = await makeModule(p.id);
    const a = await makeAssessment(m.id, new Date());
    const s = await makeStudent(p.id);

    const bad = await call(grades.PUT, { method: "PUT", json: { assessmentId: a.id, studentId: s.id, mark: 101 } });
    expect(bad.status).toBe(400);

    const g = await call(grades.PUT, { method: "PUT", json: { assessmentId: a.id, studentId: s.id, mark: 68 } });
    expect(g.status).toBe(200);
    expect(g.data.classification).toBe("MERIT");

    const hidden = await call(myResults.GET, { as: { studentId: s.id } });
    expect(hidden.data).toEqual({ status: "WITHHELD", reason: null });

    expect((await call(publish.POST, { method: "POST", params: { id: s.id } })).status).toBe(200);
    const shown = await call(myResults.GET, { as: { studentId: s.id } });
    expect(shown.data.status).toBe("PUBLISHED");
    expect(shown.data.grades[0]).toMatchObject({ mark: 68, classification: "MERIT" });

    const w = await call(withhold.POST, { method: "POST", params: { id: s.id }, json: { reason: "" } });
    expect(w.status).toBe(400);
  });
});

describe("audit trail through the API", () => {
  it("records the acting role on changes", async () => {
    const p = await makeProgramme();
    const created = await call(students.POST, { method: "POST", json: studentBody(p.id) });
    const log = await db.auditLog.findFirstOrThrow({ where: { studentId: created.data.id } });
    expect(log.actor).toMatch(/^user:registry_admin\..*@test\.local$/);
  });
});
