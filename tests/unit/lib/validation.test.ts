import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateSchema,
  changePasswordSchema,
  loginSchema,
  passwordSchema,
  createAssessmentSchema,
  createStudentSchema,
  gradeSchema,
  recordPaymentSchema,
  studentListQuerySchema,
  updateStudentSchema,
  withholdResultsSchema,
} from "@/lib/validation";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const validStudent = {
  fullName: "  Ada   Lovelace ",
  email: "Ada.Lovelace@Example.COM ",
  dateOfBirth: "2004-05-10",
  programmeId: "prog_1",
  academicYear: "2025/26",
  status: "ENROLLED",
};

const fieldErrors = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.error?.issues.map((i) => i.path.join(".")) ?? [];

describe("createStudentSchema", () => {
  it("normalises name whitespace and lower-cases email", () => {
    const r = createStudentSchema.parse(validStudent);
    expect(r.fullName).toBe("Ada Lovelace");
    expect(r.email).toBe("ada.lovelace@example.com");
    expect(r.dateOfBirth).toEqual(new Date("2004-05-10T00:00:00Z"));
  });

  it("defaults status to ENROLLED", () => {
    const { status: _omit, ...rest } = validStudent;
    expect(createStudentSchema.parse(rest).status).toBe("ENROLLED");
  });

  it("rejects a date of birth in the future", () => {
    expect(fieldErrors(createStudentSchema.safeParse({ ...validStudent, dateOfBirth: "2027-01-01" }))).toContain("dateOfBirth");
  });

  it("rejects students younger than 16", () => {
    expect(fieldErrors(createStudentSchema.safeParse({ ...validStudent, dateOfBirth: "2010-03-16" }))).toContain("dateOfBirth");
  });

  it("rejects impossible calendar dates", () => {
    expect(fieldErrors(createStudentSchema.safeParse({ ...validStudent, dateOfBirth: "2004-02-31" }))).toContain("dateOfBirth");
  });

  it("rejects a non-consecutive academic year", () => {
    expect(fieldErrors(createStudentSchema.safeParse({ ...validStudent, academicYear: "2025/27" }))).toContain("academicYear");
  });

  it("rejects an invalid email and an unknown status", () => {
    const errs = fieldErrors(createStudentSchema.safeParse({ ...validStudent, email: "nope", status: "EXPELLED" }));
    expect(errs).toEqual(expect.arrayContaining(["email", "status"]));
  });

  it("requires a name of at least two characters", () => {
    expect(fieldErrors(createStudentSchema.safeParse({ ...validStudent, fullName: " A " }))).toContain("fullName");
  });
});

describe("updateStudentSchema", () => {
  it("allows partial updates", () => {
    expect(updateStudentSchema.parse({ status: "DEFERRED" })).toEqual({ status: "DEFERRED" });
  });

  it("rejects an empty update", () => {
    expect(updateStudentSchema.safeParse({}).success).toBe(false);
  });
});

describe("recordPaymentSchema", () => {
  const valid = { amount: "1250.50", paidOn: "2026-03-10", reference: "  bacs-0001 ", method: "BANK_TRANSFER" };

  it("accepts a valid payment and normalises the reference", () => {
    const r = recordPaymentSchema.parse(valid);
    expect(r.amount).toBe("1250.50");
    expect(r.reference).toBe("BACS-0001");
  });

  it.each(["0", "-5", "10.555", "abc", "1000000.00"])("rejects amount %s", (amount) => {
    expect(fieldErrors(recordPaymentSchema.safeParse({ ...valid, amount }))).toContain("amount");
  });

  it("accepts a numeric amount", () => {
    expect(recordPaymentSchema.parse({ ...valid, amount: 99.5 }).amount).toBe("99.50");
  });

  it("rejects a payment dated in the future", () => {
    expect(fieldErrors(recordPaymentSchema.safeParse({ ...valid, paidOn: "2026-03-16" }))).toContain("paidOn");
  });

  it("accepts a payment dated today", () => {
    expect(recordPaymentSchema.safeParse({ ...valid, paidOn: "2026-03-15" }).success).toBe(true);
  });

  it("requires a reference", () => {
    expect(fieldErrors(recordPaymentSchema.safeParse({ ...valid, reference: "   " }))).toContain("reference");
  });
});

describe("gradeSchema", () => {
  const valid = { assessmentId: "a1", studentId: "s1", mark: 65 };

  it.each([0, 40, 100, "72.5"])("accepts %s", (mark) => {
    expect(gradeSchema.safeParse({ ...valid, mark }).success).toBe(true);
  });

  it.each([-1, 100.5, 55.555, "", "abc", null])("rejects %s", (mark) => {
    expect(fieldErrors(gradeSchema.safeParse({ ...valid, mark }))).toContain("mark");
  });
});

describe("createAssessmentSchema", () => {
  it("parses an ISO deadline", () => {
    const r = createAssessmentSchema.parse({ title: " Essay 1 ", moduleId: "m1", deadline: "2026-04-01T17:00:00Z" });
    expect(r.title).toBe("Essay 1");
    expect(r.deadline).toEqual(new Date("2026-04-01T17:00:00Z"));
  });

  it("rejects a missing or invalid deadline", () => {
    expect(fieldErrors(createAssessmentSchema.safeParse({ title: "Essay", moduleId: "m1", deadline: "soon" }))).toContain("deadline");
  });
});

describe("withholdResultsSchema", () => {
  it("requires a reason", () => {
    expect(fieldErrors(withholdResultsSchema.safeParse({ reason: "" }))).toContain("reason");
  });

  it("defaults shareReason to false", () => {
    expect(withholdResultsSchema.parse({ reason: "Outstanding fees" }).shareReason).toBe(false);
  });
});

describe("studentListQuerySchema", () => {
  it("treats empty strings from the URL as 'no filter'", () => {
    expect(studentListQuerySchema.parse({ q: "", status: "", programmeId: "", sort: "" })).toEqual({ page: 1, pageSize: 20, sort: "name" });
  });

  it("coerces page and clamps pageSize", () => {
    expect(studentListQuerySchema.parse({ page: "3", pageSize: "500" })).toMatchObject({ page: 3, pageSize: 100 });
  });

  it("rejects an unknown status", () => {
    expect(studentListQuerySchema.safeParse({ status: "NOPE" }).success).toBe(false);
  });

  it("accepts a known sort and defaults to name", () => {
    expect(studentListQuerySchema.parse({ sort: "-year" }).sort).toBe("-year");
    expect(studentListQuerySchema.parse({}).sort).toBe("name");
  });

  it("rejects an unknown sort so the page can fall back with a notice", () => {
    expect(studentListQuerySchema.safeParse({ sort: "bogus" }).success).toBe(false);
  });
});

describe("auth schemas", () => {
  it("normalises the login email", () => {
    expect(loginSchema.parse({ email: "  Admin@Demo.SMS ", password: "x" }).email).toBe("admin@demo.sms");
  });

  it("rejects short passwords", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("long-enough-1").success).toBe(true);
  });

  it("requires a token and a valid new password to activate", () => {
    expect(activateSchema.safeParse({ token: "", password: "long-enough-1" }).success).toBe(false);
    expect(activateSchema.safeParse({ token: "t", password: "short" }).success).toBe(false);
  });

  it("requires the current and a valid new password to change password", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "a", newPassword: "long-enough-1" }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ currentPassword: "", newPassword: "long-enough-1" }).success).toBe(false);
  });
});
