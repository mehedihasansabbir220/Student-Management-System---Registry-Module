/**
 * Input schemas shared by client forms (UX) and API routes (source of truth).
 * Keep this file free of server-only imports.
 */
import { z } from "zod";
import { isValidAcademicYear } from "@/domain/student-number";

export const ENROLMENT_STATUSES = ["ENROLLED", "DEFERRED", "WITHDRAWN", "COMPLETED"] as const;
export const PAYMENT_METHODS = ["BANK_TRANSFER", "CARD", "CASH", "SPONSOR", "OTHER"] as const;
export const MIN_STUDENT_AGE = 16;
const MAX_PAYMENT_PENCE = 99_999_999; // £999,999.99

// ---------- helpers ----------------------------------------------------------

/** Treat "" (empty form field / query param) as "not provided". */
const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const todayUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

/** Strict YYYY-MM-DD → UTC midnight Date. Rejects 2004-02-31 etc. */
const dateOnly = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a date (YYYY-MM-DD)`)
    .transform((s, ctx) => {
      const d = new Date(`${s}T00:00:00Z`);
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
        ctx.addIssue({ code: "custom", message: `${label} is not a real calendar date` });
        return z.NEVER;
      }
      return d;
    });

const moneyAmount = z
  .union([z.string(), z.number()], { error: "Amount is required" })
  .transform((v, ctx) => {
    const s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : v.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(s)) {
      ctx.addIssue({ code: "custom", message: "Enter an amount in pounds with up to 2 decimal places" });
      return z.NEVER;
    }
    const [whole, frac = ""] = s.split(".");
    const pence = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
    if (pence <= 0) {
      ctx.addIssue({ code: "custom", message: "Amount must be greater than zero" });
      return z.NEVER;
    }
    if (pence > MAX_PAYMENT_PENCE) {
      ctx.addIssue({ code: "custom", message: "Amount is unrealistically large — check for a typo" });
      return z.NEVER;
    }
    return `${Math.floor(pence / 100)}.${String(pence % 100).padStart(2, "0")}`;
  });

const id = (label: string) => z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`);

// ---------- students ---------------------------------------------------------

const fullName = z
  .string({ error: "Full name is required" })
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(2, "Full name must be at least 2 characters").max(120, "Full name is too long"));

const email = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(254));

const dateOfBirth = dateOnly("Date of birth").refine((d) => d <= todayUtc(), "Date of birth cannot be in the future").refine((d) => {
  const t = todayUtc();
  const sixteenth = new Date(Date.UTC(d.getUTCFullYear() + MIN_STUDENT_AGE, d.getUTCMonth(), d.getUTCDate()));
  return sixteenth <= t;
}, `Students must be at least ${MIN_STUDENT_AGE} years old`);

const academicYear = z
  .string({ error: "Academic year is required" })
  .trim()
  .refine(isValidAcademicYear, "Use the format YYYY/YY with consecutive years, e.g. 2025/26");

const status = z.enum(ENROLMENT_STATUSES, { error: "Choose a valid enrolment status" });

export const createStudentSchema = z.object({
  fullName,
  email,
  dateOfBirth,
  programmeId: id("Programme"),
  academicYear,
  status: status.default("ENROLLED"),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z
  .object({
    fullName: fullName.optional(),
    email: email.optional(),
    dateOfBirth: dateOfBirth.optional(),
    academicYear: academicYear.optional(),
    status: status.optional(),
  })
  .refine((o) => Object.values(o).some((v) => v !== undefined), "Nothing to update");
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

/** Sortable student-list columns; a leading "-" means descending. */
export const STUDENT_SORTS = ["name", "-name", "studentNumber", "-studentNumber", "year", "-year", "enrolled", "-enrolled"] as const;
export type StudentSort = (typeof STUDENT_SORTS)[number];

export const studentListQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  programmeId: z.preprocess(emptyToUndefined, z.string().optional()),
  status: z.preprocess(emptyToUndefined, status.optional()),
  academicYear: z.preprocess(emptyToUndefined, z.string().optional()),
  sort: z.preprocess(emptyToUndefined, z.enum(STUDENT_SORTS, { error: "Unknown sort" }).default("name")),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
  pageSize: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).default(20).transform((n) => Math.min(n, 100)),
  ),
});
/** Parsed list query; `sort` is optional for internal callers (defaults to name). */
export type StudentListQuery = Omit<z.infer<typeof studentListQuerySchema>, "sort"> & { sort?: StudentSort };

// ---------- fees & payments --------------------------------------------------

export const recordPaymentSchema = z.object({
  amount: moneyAmount,
  paidOn: dateOnly("Payment date").refine((d) => d <= todayUtc(), "Payment date cannot be in the future"),
  reference: z
    .string({ error: "Reference is required" })
    .transform((s) => s.trim().toUpperCase())
    .pipe(z.string().min(1, "Reference is required").max(64, "Reference is too long")),
  method: z.enum(PAYMENT_METHODS).default("BANK_TRANSFER"),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const voidPaymentSchema = z.object({
  reason: z.string({ error: "A reason is required" }).trim().min(3, "Give a reason for voiding this payment").max(500),
});

export const addFeeSchema = z.object({
  description: z.string().trim().min(2, "Description is required").max(120),
  amount: moneyAmount,
  dueDate: dateOnly("Due date"),
});
export type AddFeeInput = z.infer<typeof addFeeSchema>;

// ---------- assessments ------------------------------------------------------

const deadline = z
  .string({ error: "Deadline is required" })
  .trim()
  .transform((s, ctx) => {
    const d = new Date(s);
    if (!s || Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid deadline date and time" });
      return z.NEVER;
    }
    return d;
  });

export const createAssessmentSchema = z.object({
  title: z.string({ error: "Title is required" }).trim().min(2, "Title is required").max(160),
  moduleId: id("Module"),
  deadline,
});
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const updateAssessmentSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  deadline: deadline.optional(),
});

// ---------- grades & results -------------------------------------------------

const mark = z
  .union([z.number(), z.string()], { error: "Enter a mark between 0 and 100" })
  .transform((v, ctx) => {
    const s = typeof v === "number" ? String(v) : v.trim();
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) {
      ctx.addIssue({ code: "custom", message: "Enter a mark between 0 and 100 (max 2 decimal places)" });
      return z.NEVER;
    }
    const n = Number(s);
    if (n < 0 || n > 100) {
      ctx.addIssue({ code: "custom", message: "Mark must be between 0 and 100" });
      return z.NEVER;
    }
    return n;
  });

export const gradeSchema = z.object({
  assessmentId: id("Assessment"),
  studentId: id("Student"),
  mark,
});
export type GradeInput = z.infer<typeof gradeSchema>;

export const withholdResultsSchema = z.object({
  reason: z.string({ error: "A reason is required" }).trim().min(3, "Give a reason for withholding").max(300),
  shareReason: z.boolean().default(false),
});
export type WithholdResultsInput = z.infer<typeof withholdResultsSchema>;

// ---------- authentication ---------------------------------------------------

export const PASSWORD_MIN = 10;

export const passwordSchema = z
  .string({ error: "Password is required" })
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(200, "Password is too long");

export const loginSchema = z.object({
  email: z.string({ error: "Email is required" }).trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  // No policy check on login: never tell an attacker which rule a password fails.
  password: z.string({ error: "Password is required" }).min(1, "Password is required").max(200),
});

export const activateSchema = z.object({
  token: z.string({ error: "Activation link is invalid" }).trim().min(1, "Activation link is invalid"),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string({ error: "Enter your current password" }).min(1, "Enter your current password"),
  newPassword: passwordSchema,
});

// ---------- session ----------------------------------------------------------

export const sessionSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("STAFF") }),
  z.object({ role: z.literal("STUDENT"), studentId: id("Student") }),
]);
