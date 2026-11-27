# Student Management System — Registry Module

A focused Registry application covering the four workflows a Registry Administrator uses every day:

1. **Student enrolment** — records, auto-generated Student IDs, status lifecycle, search & filter
2. **Fees & payments** — programme fees, payment recording, real-time balances, overdue flags
3. **Assessment submission** — PDF/DOCX uploads, resubmission rules, late flagging
4. **Marksheet & results** — grade entry, classification, per-student publish/withhold

**Stack:** Next.js 15 (App Router) · TypeScript · PostgreSQL · Prisma 6 · zod · Tailwind CSS 4 · Vitest

> The original brief is in [`requirement.md`](./requirement.md). Task breakdown, design notes and decisions per feature are in [`doc/`](./doc/README.md).

---

## Quick start

**Prerequisites:** Node.js 20+ and PostgreSQL 14+.

```bash
git clone https://github.com/mehedihasansabbir220/Student-Management-System---Registry-Module && cd student-management-system
cp .env.example .env              # then edit DATABASE_URL / TEST_DATABASE_URL
createdb sms && createdb sms_test # or create them in your Postgres GUI
npm install                       # also runs `prisma generate`
npm run db:setup                  # apply migrations + load demo data
npm run dev                       # http://localhost:3000
```

Open http://localhost:3000 and choose **Registry staff** or any student. Use the **"Viewing as"** switcher in the header to change role at any time.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build && npm start` | Production build + server |
| `npm run db:setup` | `prisma migrate deploy` + seed |
| `npm run db:seed` | Reset all data and reload the demo dataset (idempotent) |
| `npm test` | Unit + integration tests (integration uses `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Smoke tests against a running server (`E2E_BASE_URL`, default `http://localhost:3000`) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |

### Environment variables

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://postgres:postgres@localhost:5432/sms?schema=public` | App database |
| `TEST_DATABASE_URL` | for tests | `postgresql://postgres:postgres@localhost:5432/sms_test?schema=public` | Integration-test database. **Wiped by tests**; must differ from `DATABASE_URL` (enforced) |
| `UPLOAD_DIR` | | `./uploads` | Where submitted files are stored (git-ignored) |
| `MAX_UPLOAD_MB` | | `10` | Upload size limit |
| `LOG_LEVEL` | | `info` | `debug` \| `info` \| `warn` \| `error` |
| `LOG_FILE` | | `./logs/app.log` | Also append JSON logs to this file (empty = stdout only) |
| `LOG_SQL` | | `false` | Log every SQL query at debug level |
| `NEXT_DIST_DIR` | | `.next-verify` | Build output folder — lets you run a production build while `next dev` is running |

Environment is validated on first use (`src/server/config.ts`); a bad value fails loudly with a clear message.

---

## Demo data

`npm run db:seed` creates 2 programmes, 4 modules, 5 assessments and 8 students. Every record goes through the **real service layer**, so IDs, fee snapshots, lateness and the audit trail are produced exactly as in the UI. Dates are relative to "today", so overdue and late states always look right.

| Student | Programme | Demonstrates |
|---|---|---|
| Amelia Clarke | BSc CS | Paid in full · on-time submission · Distinction (72) · results **published** |
| Oliver Bennett | BSc CS | **Overdue** balance · a **voided** (bounced) payment · **late** submission · Pass at boundary (40) · results **withheld with reason shared** ("Outstanding tuition fees") |
| Priya Sharma | BSc CS | Part-paid, not yet due · **resubmission (v2)** · Merit at boundary (60) · graded but **awaiting release** |
| Daniel Okafor | BA Bus | Nothing paid, **overdue** · late submission · Fail (35) · withheld, reason **not** shared |
| Sophie Martin | BA Bus | **Overpaid → £250 credit** · Distinction (82) · published |
| James Wilson | BSc CS | **Deferred** · cannot submit · balance not yet due |
| Hannah Lee | BA Bus | **Withdrawn while owing money** — still flagged overdue |
| Ethan Hughes | BSc CS | 2024/25 intake (**SMS-2024-0001**) · **Completed** · Distinction at boundary (70) |

---

## Product decisions & edge cases

The brief sets the core rules; these are the decisions I made where it was silent, and why.

### Enrolment
- **Student ID** `SMS-{intake year}-{seq}`. The sequence is per intake year and incremented **inside the enrolment transaction** with an atomic upsert, so concurrent enrolments can never collide. A failed enrolment rolls the counter back, so no IDs are wasted. IDs are never reused. *(Tested with 10 concurrent creates.)*
- Email is unique **case-insensitively** (stored lower-cased; also a DB CHECK).
- Validation: date of birth not in the future and student ≥ 16; academic year must be `YYYY/YY` with consecutive years; real calendar dates only (`2004-02-31` is rejected).
- Students are never deleted. Leaving is a **status** (`WITHDRAWN`), so financial and academic history is kept.
- Status changes warn about their consequences (Withdrawn/Deferred/Completed → cannot submit; Completed while owing money → explicit warning).

### Fees & payments
- The fee is defined on the **programme** but **snapshotted** onto the student's account at enrolment. A later price change doesn't silently rewrite what existing students owe.
- Default due date: 30 days after enrolment. Staff can add extra charges (e.g. resit fee).
- **The balance is never stored.** It is always computed from charges minus payments, so it is real-time by construction.
- **Overdue** = unpaid money on a charge whose due date has passed. Payments are applied to the **oldest charge first**, so a student who has paid last term but not a resit fee due next month is *not* flagged.
- **Payment references are unique.** The same bank transfer can't be keyed twice (409 with a field error).
- **Payments are append-only.** A mistake or bounced cheque is **voided with a reason** (audited), never deleted. Voiding twice is rejected atomically.
- **Overpayment** is accepted (with a warning before saving) and shown as **credit**, never as a negative balance.
- **Withdrawn students with debt stay on the overdue list.** Withdrawing doesn't cancel the debt.
- Money is `Decimal(10,2)` in the DB and **integer pence** in the domain layer. There is no floating-point arithmetic anywhere.

### Submissions
| Situation | Outcome |
|---|---|
| Before / at deadline | Accepted (resubmission replaces the file, version increments) |
| After deadline, nothing submitted yet | Accepted, **flagged late** |
| After deadline, already submitted | **Rejected**: on-time work can't be overwritten after the deadline, and only one late attempt is allowed |
| Student not `ENROLLED` | Rejected with a clear reason |
| Assessment not on the student's programme | 403 |

- The deadline check uses the **server clock**, never the client's.
- `isLate` is recorded at upload time, so **extending a deadline later doesn't rewrite history**.
- Files are validated by **content (magic bytes)**, not just extension or the browser's MIME type. A renamed `.exe` is rejected. The size limit is checked from `Content-Length` before the body is buffered.
- Storage writes the new file first, then the DB transaction. If the DB fails, the new file is deleted (no orphans); on success the old file is removed. Storage keys are UUIDs and protected against path traversal.
- Downloads are always `Content-Disposition: attachment` with `nosniff`, because uploaded content is untrusted. Students can only download their own files.

### Marksheet & results
- Classification: **Fail < 40 ≤ Pass < 60 ≤ Merit < 70 ≤ Distinction** (inclusive boundaries, tested at each edge).
- Marks: 0–100, max 2 decimal places, also enforced by a DB CHECK.
- **Results default to WITHHELD.** Nothing becomes visible by accident.
- Withholding requires a **reason** (e.g. outstanding fees, moderation, misconduct). Staff choose whether the student sees it.
- **Withheld marks are filtered on the server.** The student API returns `{ status: "WITHHELD" }` with no marks at all, rather than hiding them in the browser.
- You can't publish a student with no grades. The UI suggests withholding when a student has overdue fees, but doesn't force it, since that's a policy decision.
- Grading a student with no submission is allowed (e.g. a 0 for non-submission) but warned. Changing a grade **after publication** is allowed, audited with `afterPublication: true`, and logged as a warning.

### Registry dashboard
Overdue balances (largest first, with days overdue), deadlines in the next 7 days with outstanding counts, recent late submissions, results awaiting release, and a finance summary (billed / collected / outstanding / credit).

---

## Architecture

```
src/
  domain/        Pure business rules (no I/O): fees, grades, submissions, student IDs, money, file types
  server/
    services/    Use-cases: students, fees, assessments, submissions, results, dashboard
    http.ts      Route wrapper: request id, access log, error → HTTP mapping
    errors.ts    Typed AppErrors (Validation 400, Forbidden 403, NotFound 404, Conflict 409, BusinessRule 422, …)
    logger.ts    Structured JSON logger with per-request context (AsyncLocalStorage)
    session.ts   Simulated auth + requireStaff / requireStudent guards
    audit.ts     Audit entries written in the same transaction as the change
    storage.ts   File storage (swappable for S3)
  lib/           Shared with the browser: zod schemas, formatting, API client, access rules
  app/           Pages (staff/, me/) and API routes (api/)
prisma/          Schema, migrations (incl. CHECK constraints), seed
tests/           unit/ · integration/ (real Postgres) · e2e/ (running server)
```

- **Layering:** pages and API routes → services → domain. Business rules live in `src/domain` as pure functions, so they're trivially testable and shared between the server and the UI (e.g. the live classification preview uses the same `classify()` as the API).
- **Server Components** read through services directly. **Mutations** go through the JSON API, so every write path is validated, authorised, audited and logged the same way.
- **Defence in depth:** zod at the edge, rules in services, and unique + CHECK constraints in Postgres.

### Data model

```mermaid
erDiagram
  Programme ||--o{ Module : has
  Programme ||--o{ Student : enrols
  Module ||--o{ Assessment : sets
  Student ||--o{ Fee : owes
  Student ||--o{ Payment : pays
  Student ||--o{ Submission : uploads
  Student ||--o{ Grade : receives
  Student ||--|| ResultRelease : "publish / withhold"
  Student ||--o{ AuditLog : history
  Assessment ||--o{ Submission : receives
  Assessment ||--o{ Grade : marks
```

Unique constraints: `Student.studentNumber`, `Student.email`, `Payment.reference`, `Submission(assessmentId, studentId)`, `Grade(assessmentId, studentId)`. CHECK constraints: positive amounts, mark 0–100, academic-year/ID formats, lower-case email, a voided payment must have a reason.

### Error handling & logging
- Every API route is wrapped by `route()` (`src/server/http.ts`). Responses use one shape:
  ```json
  { "error": { "code": "CONFLICT", "message": "A payment with this reference has already been recorded",
               "fields": { "reference": "…" }, "requestId": "4f0c…" } }
  ```
- Zod errors → 400 with per-field messages · Prisma unique (P2002) → 409 on the right field · not found (P2025) → 404 · DB unreachable → 503 · CHECK violation → 422 · malformed JSON → 400 · **anything unexpected → 500 with a generic message.** The stack trace goes to the log only, never to the client.
- Every request gets an `x-request-id` (middleware + route wrapper). It appears on every log line, in the response header and in the error body, and forms show it as "ref …" so a user's report can be traced to the exact log entry.
- Errors while rendering Server Components are captured by `src/instrumentation.ts` (`onRequestError`) into the same structured log.
- Error boundaries: `error.tsx`, `global-error.tsx`, `not-found.tsx` (unknown records return a real **404 status**). `GET /api/health` reports DB connectivity (503 when down), and the layout shows a banner instead of crashing if the DB is unavailable.

### Roles
Auth is simulated, as the brief allows: a cookie records "Staff" or "Student X". It's **not** a security boundary for a real deployment. Authorisation is still enforced server-side on every API route and page (students get 403 on staff endpoints and can only read their own records), and replacing the toggle with real auth only touches `src/server/session.ts`.

---

## API

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | Liveness + DB check |
| POST / DELETE | `/api/session` | — | Role toggle |
| GET / POST | `/api/students` | Staff | Search/filter (`q`, `programmeId`, `status`, `academicYear`, `page`, `pageSize`) / enrol |
| GET / PATCH | `/api/students/:id` | Staff | Profile with account / update details or status |
| GET / POST | `/api/students/:id/fees` | Staff | Account / add a charge |
| POST | `/api/students/:id/payments` | Staff | Record payment |
| POST | `/api/payments/:id/void` | Staff | Void a payment with a reason |
| GET | `/api/students/:id/results` | Staff | Full marksheet (incl. unpublished) |
| POST | `/api/students/:id/results/publish` | Staff | Publish |
| POST | `/api/students/:id/results/withhold` | Staff | Withhold `{ reason, shareReason }` |
| GET / POST | `/api/assessments` | Any / Staff | Role-aware list / create |
| GET / PATCH | `/api/assessments/:id` | Staff | Roster (on time / late / missing + marks) / edit deadline |
| POST | `/api/assessments/:id/submissions` | Student | Upload (multipart `file`) |
| GET | `/api/submissions/:id/file` | Staff or owner | Download |
| PUT | `/api/grades` | Staff | Upsert a mark |
| GET | `/api/me/results` · `/api/me/fees` · `/api/me/assessments` | Student | Own data only |
| GET | `/api/dashboard` · `/api/programmes` · `/api/modules` | Staff | Dashboard / lookups |

---

## Testing

**236 automated tests**, written test-first (red → green):

- **Unit (120)** — domain rules at every boundary (classification edges, FIFO overdue allocation, money parsing without float drift, submission rule table, file magic bytes), validation schemas, error mapping, formatting, API client, page-access rules.
- **Integration (96)** — services and **real API route handlers** against a real Postgres database: concurrent ID generation, rollback without wasting an ID, duplicate references, void races, resubmission and file replacement on disk, path traversal, authorisation (401/403 on every protected route), withheld results never leaking, seed coverage.
- **E2E smoke (20)** — a running production build: role redirects, every page rendering, seeded edge cases visible, real 404 statuses.

---

## How I used AI

I used **Claude Code** (Anthropic's CLI agent, Claude Opus) as a pair programmer throughout. I made the product decisions and reviewed every change; AI did most of the typing.

**How I worked with it**
1. **Requirements → plan.** I pasted the brief and had it produce `requirement.md` plus one task file per feature in `doc/` (scope, data model, API, edge cases, acceptance criteria). I reviewed the proposed decisions (fee snapshot, FIFO overdue, resubmission-after-deadline rule, default-withheld results) before any code was written.
2. **Test-driven development.** I asked it to work test-first. For every module it wrote failing tests, ran them to confirm they failed for the right reason, then implemented. Tests live in `tests/`, separate from `src/`.
3. **Senior-level non-functional requirements.** I explicitly asked for proper error handling, edge cases and server error logging. That led to the typed error hierarchy, the single error-response shape, request-id correlation, the JSON log file, DB CHECK constraints and the audit log.

**Where AI got it wrong (and how it was caught)**
- `instrumentation.ts` imported the Node-only logger in a way that leaked `node:fs` into the Edge bundle (`UnhandledSchemeError`). *I hit this in `npm run dev`*; fixed with the documented `NEXT_RUNTIME === "nodejs"` guard.
- The root layout's `try/catch` was **swallowing Next.js's internal dynamic-rendering signal** and logging it as an error. Caught by reading the build output; fixed with `unstable_rethrow`.
- Unknown records showed the 404 page but returned **HTTP 200**. The E2E test caught it. The first fix attempt was wrong; debugging step by step (bot vs normal user-agent, then removing `loading.tsx`) proved a Suspense boundary was flushing headers early.
- Running `next build` while my dev server was running **corrupted `.next`** (`Cannot find module './3897.js'`). Fixed by making `distDir` configurable (`NEXT_DIST_DIR`).
- Wrong Prisma event types on log listeners; unit tests writing into the real app log; editor/CLI TypeScript version mismatch. All caught by `tsc`/review and fixed.
- Prisma's safety guard blocked the agent from running `migrate reset`. Instead of bypassing it, the test setup was changed to the non-destructive `migrate deploy` + per-test `TRUNCATE`.

**What I decided myself:** the scope, every product rule in the section above, the TDD workflow, keeping tests outside `src/`, and choosing a correct HTTP status over a loading skeleton.

---

## Known limitations & next steps

- **Real authentication** (SSO / NextAuth) and finer staff roles (Finance vs Academic).
- Cloud file storage (S3) plus virus scanning of uploads; files are currently on local disk.
- Fee instalment plans, refunds of credit, and payment-provider integration.
- Extenuating circumstances / individual deadline extensions per student.
- Module- and programme-level progression rules (credits, weighted averages, resits).
- Email notifications (overdue reminders, results published).
- `npm audit` reports one high-severity advisory in `deepmerge-ts`, a dependency of the **Prisma CLI** (dev tooling only, not shipped at runtime). The fix requires Prisma 7.
