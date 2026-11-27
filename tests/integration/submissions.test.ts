import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { readSubmissionFile, submitAssessment } from "@/server/services/submissions";
import { resolveStoragePath } from "@/server/storage";
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from "@/server/errors";
import { makeAssessment, makeModule, makeProgramme, makeStudent } from "../support/factories";

const deadline = new Date("2026-03-15T17:00:00Z");
const before = new Date("2026-03-14T10:00:00Z");
const after = new Date("2026-03-16T10:00:00Z");
const pdf = (text = "hello") => new TextEncoder().encode(`%PDF-1.7\n${text}`);

async function setup(status?: "WITHDRAWN") {
  const p = await makeProgramme();
  const m = await makeModule(p.id);
  const a = await makeAssessment(m.id, deadline);
  const s = await makeStudent(p.id, status ? { status } : {});
  return { p, m, a, s };
}

const upload = (assessmentId: string, studentId: string, now: Date, bytes = pdf(), fileName = "essay.pdf") =>
  submitAssessment({ assessmentId, studentId, fileName, bytes, now, actor: "student:test" });

describe("submitAssessment", () => {
  it("stores an on-time first submission and the file on disk", async () => {
    const { a, s } = await setup();
    const sub = await upload(a.id, s.id, before);
    expect(sub).toMatchObject({ isLate: false, version: 1, mimeType: "application/pdf", originalName: "essay.pdf" });
    expect(existsSync(resolveStoragePath(sub.storageKey))).toBe(true);
  });

  it("replaces the file on resubmission before the deadline and removes the old one", async () => {
    const { a, s } = await setup();
    const first = await upload(a.id, s.id, before, pdf("v1"));
    const second = await upload(a.id, s.id, before, pdf("version two"), "essay-final.pdf");
    expect(second).toMatchObject({ id: first.id, version: 2, originalName: "essay-final.pdf", isLate: false });
    expect(existsSync(resolveStoragePath(first.storageKey))).toBe(false);
    expect(await db.submission.count()).toBe(1);
  });

  it("accepts a first submission after the deadline and flags it late", async () => {
    const { a, s } = await setup();
    expect((await upload(a.id, s.id, after)).isLate).toBe(true);
  });

  it("refuses to overwrite on-time work after the deadline and leaves the original intact", async () => {
    const { a, s } = await setup();
    const first = await upload(a.id, s.id, before);
    await expect(upload(a.id, s.id, after)).rejects.toBeInstanceOf(BusinessRuleError);
    const stored = await db.submission.findUniqueOrThrow({ where: { id: first.id } });
    expect(stored.version).toBe(1);
    expect(existsSync(resolveStoragePath(first.storageKey))).toBe(true);
  });

  it("refuses submissions from withdrawn students", async () => {
    const { a, s } = await setup("WITHDRAWN");
    await expect(upload(a.id, s.id, before)).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("refuses submissions to an assessment outside the student's programme", async () => {
    const { a } = await setup();
    const other = await makeStudent((await makeProgramme()).id);
    await expect(upload(a.id, other.id, before)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a file that is not really a PDF", async () => {
    const { a, s } = await setup();
    await expect(upload(a.id, s.id, before, new TextEncoder().encode("MZ fake"), "x.pdf")).rejects.toBeInstanceOf(
      UnsupportedMediaTypeError,
    );
  });

  it("rejects files over the size limit before touching disk", async () => {
    const { a, s } = await setup();
    const big = new Uint8Array(1024 * 1024 + 1);
    big.set(pdf());
    await expect(upload(a.id, s.id, before, big)).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(await db.submission.count()).toBe(0);
  });

  it("throws NotFoundError for an unknown assessment", async () => {
    const { s } = await setup();
    await expect(upload("nope", s.id, before)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("audits first submissions and replacements separately", async () => {
    const { a, s } = await setup();
    await upload(a.id, s.id, before);
    await upload(a.id, s.id, before);
    const actions = (await db.auditLog.findMany({ where: { studentId: s.id }, orderBy: { createdAt: "asc" } })).map((l) => l.action);
    expect(actions).toEqual(["submission.created", "submission.replaced"]);
  });
});

describe("readSubmissionFile", () => {
  it("lets staff and the owning student download, but not another student", async () => {
    const { p, a, s } = await setup();
    const sub = await upload(a.id, s.id, before, pdf("secret essay"));
    const other = await makeStudent(p.id);

    const asStaff = await readSubmissionFile(sub.id, { role: "STAFF" });
    expect(new TextDecoder().decode(asStaff.bytes)).toContain("secret essay");
    await expect(readSubmissionFile(sub.id, { role: "STUDENT", studentId: s.id })).resolves.toBeTruthy();
    await expect(readSubmissionFile(sub.id, { role: "STUDENT", studentId: other.id })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("resolveStoragePath", () => {
  it("refuses keys that escape the upload directory", () => {
    expect(() => resolveStoragePath("../../etc/passwd")).toThrow();
  });
});
