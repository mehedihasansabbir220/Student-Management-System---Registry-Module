# Student Management System — Registry Module

A focused Registry application covering the four workflows a Registry Administrator uses every day:

1. **Student enrolment** — records, auto-generated Student IDs, status lifecycle, search & filter
2. **Fees & payments** — programme fees, payment recording, real-time balances, overdue flags
3. **Assessment submission** — PDF/DOCX uploads, resubmission rules, late flagging
4. **Marksheet & results** — grade entry, classification, per-student publish/withhold

Around them: **real sign-in with four roles** (Registry Admin, Finance, Academic, Student), an audit trail, and a staff app plus a student portal built on shadcn/ui.

**Stack:** Next.js 15 (App Router) · TypeScript · PostgreSQL · Prisma 6 · zod · Tailwind CSS 4 · shadcn/ui · jose (JWT) · Vitest · Playwright

### Documentation

| Document | What's in it |
|---|---|
| [`docs/ROLES.md`](./docs/ROLES.md) | **Start here to read the code:** what each role (Registry Admin, Finance, Academic, Student) can do, and for every feature the screen, API route, permission and service function that implement it |
| [`docs/FEATURES.md`](./docs/FEATURES.md) | Feature tour by role, with the edge cases each feature handles |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Layers, request lifecycle, authentication, permission matrix, data model, UI system, error handling, testing |
| [`requirement.md`](./requirement.md) | The original brief, followed by **requirement coverage** and **what was added beyond the brief, and why** |
| [`doc/`](./doc/README.md) | v1 task breakdown and per-feature design notes |
| [`docs/superpowers/`](./docs/superpowers/) | v2 design spec and implementation plans |

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

Open http://localhost:3000. With `DEMO_MODE=true` (the default in `.env.example`) the sign-in page shows **one-click demo accounts** for each role:

| Account | Role | Password |
|---|---|---|
| `admin@demo.sms` | Registry Admin (everything) | `DEMO_PASSWORD` (default `Demo@12345`) |
| `finance@demo.sms` | Finance Officer (fees and payments) | same |
| `academic@demo.sms` | Academic Staff (assessments and marking) | same |
| `amelia.clarke@student.example.ac.uk` | Student (portal) | same |

Every seeded student can sign in with `firstname.lastname@student.example.ac.uk`, except James Wilson, whose account is left *invitation pending* to show the activation flow.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build && npm start` | Production build + server |
| `npm run db:setup` | `prisma migrate deploy` + seed |
| `npm run db:seed` | Reset all data and reload the demo dataset (idempotent) |
| `npm test` | Unit + integration tests (integration uses `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Smoke tests against a running server (`E2E_BASE_URL`, default `http://localhost:3000`) |
| `npm run test:browser` | Playwright browser tests for every role (builds and serves on :3100 against the seeded **test** database; run `npx playwright install chromium` once) |
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
| `JWT_SECRET` | ✅ | `openssl rand -base64 48` | Signs access tokens (HS256). At least 32 characters |
| `DEMO_MODE` | | `true` | Show one-click demo accounts on the sign-in page. **Never enable in a real deployment** |
| `DEMO_PASSWORD` | | `Demo@12345` | Password for every seeded demo account |
| `NEXT_DIST_DIR` | | `.next-verify` | Build output folder — lets you run a production build while `next dev` is running |

Environment is validated on first use (`src/server/config.ts`); a bad value fails loudly with a clear message.

---

## Demo data

`npm run db:seed` creates 2 programmes, 4 modules, 5 assessments, 8 students and the demo staff accounts. Every record goes through the **real service layer**, so IDs, fee snapshots, lateness and the audit trail are produced exactly as in the UI. Dates are relative to "today", so overdue and late states always look right.

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
Overdue balances (oldest debt first, with days overdue), deadlines in the next 7 days with outstanding counts, recent late submissions, results awaiting release, and a finance summary (billed / collected / outstanding / credit). **What each role sees follows its permissions:** Finance gets the money queues, Academic the coursework queues, the Registry Admin everything.

### Roles & access
- **Four roles.** Academics mark work but releasing results is a Registry decision; Finance handles money but never touches grades. One permission matrix (`src/domain/permissions.ts`) drives the API guards, page guards, navigation, dashboard and student-record tabs.
- **Data is withheld, not just hidden.** A page only loads the sections a role may see, so finance figures never reach an Academic's browser and marks never reach Finance's.
- **Shared demo accounts are protected on the server:** they can't be locked, have their password changed, or sign other reviewers out, and each reviewer only sees their own session.

---

## Architecture

```
src/
  domain/        Pure business rules (no I/O): money, fees, grades, submissions, student IDs, file types, permissions
  lib/           Shared with the browser: zod schemas, API client, access rules, UI logic (nav, table state, …)
  server/        Services (use-cases), auth (scrypt, JWT, refresh rotation), guards, errors, logger, audit, storage
  components/    shadcn/ui primitives, app shell, data table, form kit
  app/           (auth)/ sign-in & activation · staff/ · me/ (student portal) · api/
prisma/          Schema, migrations (incl. CHECK constraints), seed
tests/           unit/ · integration/ (real Postgres) · e2e/ (running server) · browser/ (Playwright)
```

- **Layering:** pages and API routes → services → domain. Rules are pure functions, shared by server and UI (the live classification preview uses the same `classify()` as the API).
- **Reads** in Server Components go through services; **writes** always go through the JSON API, so every mutation is validated, authorised, audited and logged the same way.
- **Authentication:** hand-written JWT (15-minute access token, 7-day rotating refresh token with reuse detection), scrypt passwords, lockout and per-IP rate limiting, single-use activation links.
- **Defence in depth:** zod at the edge, rules in services, unique and CHECK constraints in Postgres.
- **Errors:** one error body `{ error: { code, message, fields?, requestId } }`. Every request has an id that appears in the logs and on the user's screen as "Reference: …".

The full write-up, with diagrams of the request flow, refresh rotation and data model, is in **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**.

---

## API

All routes return JSON (or the standard error body). "Permission" is from the matrix in `src/domain/permissions.ts`.

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | Liveness + DB check |
| POST | `/api/auth/login` · `/api/auth/logout` · `/api/auth/refresh` | — | Sign in (rate-limited) / out / rotate the refresh token |
| POST | `/api/auth/activate` | — | Set a password from an activation link |
| GET | `/api/auth/me` | signed in | Current user |
| POST | `/api/auth/change-password` | signed in | Change password (signs out other sessions) |
| GET / DELETE | `/api/auth/sessions` | signed in | List sessions / sign out the others |
| GET / POST | `/api/students` | `students.read` / `students.write` | Search, filter, sort, page / enrol (returns the activation link once) |
| GET / PATCH | `/api/students/:id` | `students.read` / `students.write` | Profile with account / update details or status |
| POST | `/api/students/:id/activation-link` | `students.write` | Issue a new activation link |
| GET / POST | `/api/students/:id/fees` | `finance.read` / `fees.write` | Account / add a charge |
| POST | `/api/students/:id/payments` | `payments.write` | Record a payment |
| POST | `/api/payments/:id/void` | `payments.void` | Void a payment with a reason |
| GET | `/api/students/:id/results` | `results.read` | Full marksheet (incl. unpublished) |
| POST | `/api/students/:id/results/publish` · `…/withhold` | `results.release` | Publish / withhold `{ reason, shareReason }` |
| GET / POST | `/api/assessments` | `submissions.read` (staff) or student / `assessments.write` | Role-aware list / create |
| GET / PATCH | `/api/assessments/:id` | `submissions.read` / `assessments.write` | Roster / edit deadline |
| POST | `/api/assessments/:id/submissions` | student | Upload (multipart `file`) |
| GET | `/api/submissions/:id/file` | `submissions.read` or owner | Download |
| PUT | `/api/grades` | `grades.write` | Upsert a mark |
| GET | `/api/me/assessments` · `/api/me/fees` · `/api/me/results` | student | Own data only |
| GET | `/api/dashboard` · `/api/programmes` · `/api/modules` | `dashboard.read` / `students.read` | Dashboard / lookups |

---

## Testing

**749 automated tests**, written test-first (red → green), plus CI on every push and pull request (lint, typecheck, unit + integration against Postgres, production build).

| Suite | Count | What it covers |
|---|---|---|
| **Unit** (`npm run test:unit`) | 450 | Domain rules at every boundary (classification edges, FIFO overdue, money without float drift, submission rules, file magic bytes), schemas, JWT / password / token primitives, API client refresh-and-retry, UI logic (navigation per role, breadcrumbs, table URL state, tabs, countdowns, fees statement, uploads, form-error mapping, the form hook in jsdom), and a guard that no v1 styling is left in any source file |
| **Integration** (`npm run test:integration`) | 259 | Real route handlers against a real Postgres DB: login, lockout, refresh rotation and reuse detection, activation, demo-account protection, **the permission matrix over every route and role**, concurrent ID generation, void races, file storage, withheld results never leaking, seed coverage |
| **E2E** (`npm run test:e2e`) | 24 | A running server over HTTP: real sign-in per role, redirects, every page rendering, seeded edge cases, real 404 statuses |
| **Browser** (`npm run test:browser`) | 16 | Playwright in Chromium on a production build and a freshly seeded **test** database. Smoke: one-click sign-in per role, every sidebar page with **zero console errors**, tabs, mobile sidebar, dark mode, role redirects. Flows that write data: enrol a student, record a payment (and a duplicate reference), create an assessment and mark it, upload coursework (and a rejected file type), publish results → the student sees their marks |

---

## How I used AI

I built this with **Claude Code** (Anthropic's coding agent) as a pair programmer. The split was deliberate: **I owned the product and the review; the AI did most of the typing.** Every rule in "Product decisions" above is my decision, every change was reviewed by me before it moved on, and nothing was accepted without a test proving it.

### The workflow

| Step | What I did | What the AI did |
|---|---|---|
| 1. Understand the brief | Read it as a Registry team would and decided the stakeholder rules: fee snapshot, oldest-charge-first overdue, one late submission, withheld by default | Turned the brief into `requirement.md` and one task file per feature in [`doc/`](./doc/README.md) (scope, data model, API, edge cases, acceptance criteria) |
| 2. Design before code | Approved or corrected each decision. For v2 I chose real auth over a toggle, four roles, and the redesign | Wrote the v2 design spec and a step-by-step plan per phase ([`docs/superpowers/`](./docs/superpowers/)), with exact files, interfaces and the tests that prove each task |
| 3. Build test-first | Insisted on TDD and on tests living in `tests/`, not `src/` | For every unit: wrote the failing test, ran it to watch it fail for the right reason, implemented, ran the full suite, lint and typecheck |
| 4. Review every task | Checked each task in the browser and in `git show` before approving the next, and approved every push | Stopped after each task with a summary of what changed, where, and every judgement call it made |
| 5. Keep it honest | Asked for senior-level error handling, logging and edge cases | Logged every deviation from the plan with its reason, so nothing was decided silently |

### Guardrails that made AI output trustworthy
- **A failing test first, always.** A test that passes before the code exists proves nothing. When a browser test passed on its first run, I had it deliberately broken to confirm it could fail.
- **Four test layers** (unit, integration on real Postgres, HTTP end-to-end, Playwright in a real browser) and **CI on every push**, so "it looks right" was never the bar.
- **One source of truth** for the rules that matter (the permission matrix, `classify()`, money in pence, the zod schemas), shared by server and UI, so the AI couldn't introduce two versions of a rule.
- **The database as the last line of defence:** unique and CHECK constraints catch what code review misses.

### Where the AI got it wrong, and how it was caught
| Mistake | How it was caught | Fix |
|---|---|---|
| The new enrol form sent the date of birth as a full timestamp; the API (correctly) rejected it, so enrolment would have failed | Spotted while reviewing the next task; reproduced with a failing hook test | Forms now submit exactly what the user typed and the server parses it. Now also covered by a real browser test that enrols a student |
| Shared demo accounts let one reviewer sign out every other reviewer and see their IP addresses | Code review of the sessions endpoint | Fixed on the server with tests |
| The shadcn CLI installed an unrelated npm package called `cn` when its config was incomplete | Reading the dependency diff | Removed; replaced with the standard helper |
| The table library jumped to a new major version with a different API | Checking the installed version | Pinned to the stable major |
| `instrumentation.ts` leaked a Node-only module into the Edge bundle | Running the dev server | The documented `NEXT_RUNTIME` guard |
| A `try/catch` in the layout swallowed Next.js's own rendering signal | Reading the build output | `unstable_rethrow` |
| Unknown records showed a 404 page but returned **HTTP 200** | The end-to-end test | Removed a `loading.tsx` whose Suspense boundary flushed headers early |
| A production build corrupted the running dev server's `.next` | Hit in practice | Configurable `NEXT_DIST_DIR` |
| The agent tried to run `prisma migrate reset` | Prisma's safety guard blocked it | Tests switched to non-destructive `migrate deploy` + per-test `TRUNCATE` |

### What I'd tell another engineer
AI is fastest when the thinking is already done: a clear spec, a plan with exact interfaces, and a test for every claim. It is weakest at noticing what it hasn't been asked about, which is why the review step and the tests carried more weight than the generation. The bugs above were all caught *before* submission because each layer (review, unit, integration, browser, CI) catches a different kind of mistake.

---

## Known limitations & next steps

- **No email delivery.** Activation links are copied by staff; reminders and "results published" would be notifications or emails.
- **SSO** (Microsoft / Google) as an alternative to passwords.
- **Cloud file storage** (S3) and virus scanning of uploads. Files are currently on local disk, so hosting needs a persistent volume.
- Fee instalment plans, refunds of credit, and payment-provider integration.
- Extenuating circumstances / individual deadline extensions per student.
- Module- and programme-level progression rules (credits, weighted averages, resits).
- Planned next in v2: ⌘K search, dashboard charts, notifications, printable receipts, CSV export, bulk results release, audit-log and user-management pages.
- `npm audit` reports one high-severity advisory in `deepmerge-ts`, a dependency of the **Prisma CLI** (dev tooling only, not shipped at runtime). The fix requires Prisma 7.
