# v2 — From assessment to product: design

**Date:** 2026-11-27 · **Branch:** `v2` (merged to `master` only when fully green) · **Status:** reviewed, awaiting approval

## 1. Intent

The v1 build meets every line of the PEN brief (see `requirement.md`, `doc/`). v2 exists for one reason: **out of ~100 submissions, this one should earn the interview — and then give the candidate a lot to talk about in it.**

The reviewer persona: a PEN engineer with the repo link and ~10 minutes. In that time they should:
1. get in with zero friction (one click, no typing credentials),
2. immediately feel "this is a real internal tool a Registry team would use all day", not a template demo,
3. see the brief's edge cases handled visibly (overdue, late, withheld),
4. find depth when they poke: real auth, permissions, audit trail, tests, written reasoning.

Guiding principle from the brief: *"we care more about how you think than how much you build."* So: **depth in Registry work over breadth of modules**, and every addition must be finished, tested and explainable.

## 2. Goals / non-goals / anti-goals

**Goals**
- G1 Real JWT authentication with rotating, revocable refresh tokens; four roles with distinct views and enforced permissions.
- G2 Full UI redesign on shadcn/ui: app shell (collapsible sidebar, breadcrumbs, ⌘K command palette, notifications, theme toggle, user menu), data tables, charts, dark mode, responsive to mobile.
- G3 Depth features a Registry actually uses: student 360° profile with timeline, finance ledger, printable receipts, CSV export, bulk results release, overdue reminders, notifications, audit log viewer, user management with student account activation.
- G4 Keep all v1 behaviour and its tests green; extend TDD to every new module.
- G5 Interview material: README with screenshots + decision records (ADRs); a **private, git-ignored** interview Q&A and full codebase walkthrough.

**Non-goals**
- Admissions/applications funnel, timetabling, attendance, hostels, payments gateway, real email/SMS delivery, multi-tenant/multi-institution, i18n.
- SSO/OAuth providers (documented as next step).
- Cloud file storage implementation (storage interface stays swappable; documented).

**Anti-goals (failure even if it "works")**
- Anything half-finished or broken on submission day.
- A recognisable admin-template look.
- Reviewer friction: if they have to read docs to log in, we failed.
- Weakening any v1 guarantee (withheld marks never leave the server, money never float, etc.).
- Credentials or private interview docs committed to git.

## 3. Constraints

- Brief: Next.js App Router, PostgreSQL + Prisma (schema committed), Tailwind/shadcn, no other backend framework, real DB (no mock state), `.env.example`, no credentials committed.
- Deadline: within 7 working days of 2026-11-27 (~5 working days of build left after design).
- Existing stack: Next 15.5, React 19, Prisma 6, zod 4, Tailwind 4, Vitest 4. Local Postgres 16 (`sms`, `sms_test`).
- The user runs `npm run dev` on :3000 with `.next`; verification builds must use `NEXT_DIST_DIR=.next-verify` on another port.
- Tests live in `tests/` (unit / integration / e2e), written test-first.

## 4. Approaches considered

| | Approach | Trade-off | Decision |
|---|---|---|---|
| A | **Evolve v1 on a `v2` branch**: keep `src/domain`, services, validation and 236 tests; replace the UI layer with shadcn; add an auth layer beneath routes/pages. | Reuses proven logic; git history shows the process; `master` stays submittable. More UI rewrite work. | ✅ **Chosen** (user approved) |
| B | Start from a popular shadcn admin template and port logic in. | Fast polish, but reviewers recognise templates; loses history; ports risk regressions. | Rejected |

**Auth sub-choice:** hand-rolled JWT with `jose` (chosen — every line is explainable in an interview: signing, verification, rotation, reuse detection) vs Auth.js credentials provider (standard, but hides the mechanism the user wants to be able to discuss).

## 5. Design

### 5.1 Authentication (G1)

**Data model (new Prisma models)**
- `User`: `id`, `email` (unique, lower-case), `passwordHash` (nullable until activated), `role` enum `REGISTRY_ADMIN | FINANCE | ACADEMIC | STUDENT`, `studentId` (nullable, unique → `Student`), `name`, `isActive`, `failedLoginCount`, `lockedUntil`, `lastLoginAt`, timestamps.
- `RefreshToken`: `id`, `userId`, `tokenHash` (SHA-256 of the opaque token; raw token never stored), `familyId`, `expiresAt`, `revokedAt`, `replacedById`, `userAgent`, `ip`, `createdAt`.
- `ActivationToken`: `id`, `userId`, `tokenHash`, `expiresAt` (72 h), `usedAt`, `createdAt`.

**Passwords:** `node:crypto` **scrypt** with a per-user random salt, stored as `scrypt$N$r$p$salt$hash`; compared with `timingSafeEqual`. No native dependency. Policy: ≥ 10 chars, not equal to email.

**Tokens**
- **Access token:** JWT (HS256 via `jose`), 15 min, claims `sub`, `role`, `studentId?`, `sid` (refresh family id), `iss`, `aud`, `iat`, `exp`. Cookie `sms_at`: httpOnly, `SameSite=Lax`, `Secure` in production, `Path=/`.
- **Refresh token:** 32 random bytes (base64url), 7 days, cookie `sms_rt`: httpOnly, `SameSite=Strict`, `Path=/api/auth`.
- **Rotation:** every refresh revokes the presented token and issues a new one in the same family (`replacedById`). **Reuse detection:** presenting an already-revoked refresh token revokes the *entire family* (stolen-token defence) and is logged at `warn`.
- **Logout** revokes the family and clears both cookies. Admin deactivating a user revokes all their families.
- `JWT_SECRET` (≥ 32 chars) validated in `src/server/config.ts`; missing/short secret fails fast.

**Request flow**
- **Middleware (edge, `jose` only, no DB):** verifies `sms_at` for page routes. Valid → pass role to page access rules (`src/lib/access.ts`, extended for the four roles). Missing/expired but `sms_rt` present → redirect to `/api/auth/refresh?next=<path>` which rotates and redirects back. Otherwise → `/login?next=<path>`.
- **API routes:** `requireUser/requirePermission(req, permission)` in `src/server/session.ts` verify the access token from the cookie and **re-check the user is still active in the DB** (deactivation takes effect immediately, not after 15 min). Expired token → `401 TOKEN_EXPIRED`; the browser `apiFetch` client transparently calls `/api/auth/refresh` once and retries.
- **CSRF:** `SameSite` cookies + the route wrapper rejects state-changing requests whose `Origin` header doesn't match the host (`403 FORBIDDEN`).
- **Brute force:** per-account lockout (5 failures → 15 min `lockedUntil`), plus a small in-memory per-IP limiter on `/api/auth/login` (documented as single-instance; Redis in production). Login errors never reveal whether the email exists.

**Endpoints:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET|POST /api/auth/refresh`, `GET /api/auth/me`, `POST /api/auth/activate` (token + new password), `POST /api/auth/change-password`.

**Pages:** `/login` (form + **demo account buttons** when `DEMO_MODE=true`: one click per role, using the seeded demo passwords), `/activate?token=…`, `/account` (profile, change password, active sessions with "sign out everywhere").

**The v1 role toggle and `sms_session` cookie are removed.**

### 5.2 Roles & permissions

A single permission matrix in `src/domain/permissions.ts` (pure, unit-tested): `can(role, permission): boolean`, used by API routes, pages, and to build the sidebar.

| Permission | Registry Admin | Finance | Academic | Student |
|---|---|---|---|---|
| `students.read` | ✅ | ✅ | ✅ | own |
| `students.write` (enrol, edit, status) | ✅ | | | |
| `finance.read` | ✅ | ✅ | | own |
| `payments.write` / `payments.void` / `fees.write` / `reminders.send` | ✅ | ✅ | | |
| `assessments.write` | ✅ | | ✅ | |
| `grades.write` | ✅ | | ✅ | |
| `results.release` (publish / withhold, bulk) | ✅ | | | |
| `submissions.read` | ✅ | | ✅ | own |
| `audit.read` | ✅ | | | |
| `users.manage` | ✅ | | | |

Rationale (goes in an ADR): academics mark, but releasing results is a Registry decision (often after fee/misconduct checks); Finance handles money but cannot touch grades.

A matrix-driven integration test asserts every protected route returns 403 for every role lacking its permission.

### 5.3 UI system (G2)

- **shadcn/ui** (Tailwind v4 setup) + `lucide-react` icons, `sonner` toasts, `cmdk` (via shadcn Command) for ⌘K, `@tanstack/react-table` for data tables, shadcn **Chart** (Recharts) for charts, `next-themes` for dark mode, `react-hook-form` + `@hookform/resolvers` reusing the existing shared zod schemas.
- **Visual direction:** calm, dense, professional internal tool. Neutral base, one brand accent (deep indigo), status colours used only for meaning (red = overdue/late/fail, amber = attention, green = done). Inter/Geist, tabular numerals for money. No stock illustrations or gradients-for-decoration.
- **App shell:** collapsible sidebar grouped by area (Overview · Students · Finance · Academic · Administration), filtered by permissions; top bar with breadcrumbs, ⌘K search, notifications bell with unread count, theme toggle, user menu (account, sign out). Mobile: sidebar becomes a sheet.
- **⌘K command palette:** search students (name / ID / email) and assessments server-side; quick actions filtered by permission ("Enrol student", "Record payment", "Create assessment", "Go to overdue").
- **Data tables:** server-side pagination, sorting, faceted filters (programme, status, year, account state), column visibility, row selection where bulk actions exist, URL-synced state (shareable links), empty and loading states.
- Every form: inline field errors from the API's standard error body, pending states, toasts with the request reference on failure.

### 5.4 Staff experience

| Page | Content |
|---|---|
| **Dashboard** | KPI cards (enrolled, overdue £ + count, awaiting release, collected this month), **fee collection trend** (last 12 months, bar), **enrolment by status/programme** (donut), action queues: overdue balances, deadlines next 7 days, recent late submissions, results awaiting release. Content filtered by role (Finance sees finance first; Academic sees coursework first). |
| **Students** | Data table; "Enrol student" sheet; **CSV export** of the current filtered view. |
| **Student 360°** | Header (initials avatar, name, ID, status, programme, account badge, quick actions). Tabs: **Overview** (key facts, alerts), **Finance** (charges, payments, record/void, add charge, receipts), **Coursework** (submissions, late flags, downloads), **Results** (marks, classification, average, release controls), **Timeline** (audit history rendered as a human timeline). Student account status: "Account active / Invitation pending — copy activation link". |
| **Finance** | Payments ledger (all payments, filter by date/method/voided), overdue list with **"Send reminders"** (bulk → notifications + audit), collection summary. |
| **Assessments** | Table + create dialog; detail = roster (on time / late / missing), inline grade entry with live classification, deadline edit. |
| **Results release** | Table of graded students with row selection → **bulk publish / bulk withhold (with reason)**; overdue-fee indicator per row. |
| **Audit log** (admin) | Filterable by actor, action, student, date; links to the record. |
| **Users** (admin) | Staff and student accounts, create staff user, deactivate/reactivate, resend/copy activation link, force sign-out. |

### 5.5 Student portal

| Page | Content |
|---|---|
| **Home** | Greeting; alert cards (overdue fee, deadline < 48 h, results newly published); next deadlines with countdown; balance summary. |
| **Coursework** | Assessment cards with window state; **drag-and-drop upload** with client checks + upload progress; late warning before submitting; current file + version. |
| **Fees** | Statement (charges vs payments), balance/credit/overdue, **downloadable/printable receipts**. |
| **Results** | Withheld state (with shared reason) or marksheet with classification and average, printable. |
| **Notifications** | List with read/unread; bell in top bar. |
| **Account** | Change password, sessions. |

### 5.6 New supporting features (backend)

- **Notifications:** model `Notification` (`userId`, `type`, `title`, `body`, `href`, `readAt`, `createdAt`). Created **in the same transaction** as: results published, results withheld (only if reason shared), payment recorded (to student), reminder sent, submission received (to student, confirmation). Endpoints: list, mark read, mark all read, unread count.
- **Overdue reminders:** Finance selects overdue students (or "all overdue") → one notification each + audit entry; idempotency guard: not more than one reminder per student per 24 h (returns which were skipped).
- **Receipts:** `/receipts/[paymentId]` print-optimised page (institution header, receipt number = payment reference, amount, method, date, running balance). Access: finance/admin or owning student; voided payments show "VOID".
- **CSV export:** `GET /api/students/export?<same filters>` → `text/csv` streamed; RFC 4180 quoting; **CSV/formula-injection protection** (cells starting with `= + - @` tab/CR are prefixed with `'`). Audit entry per export.
- **Bulk results release:** `POST /api/results/bulk` `{ studentIds, action: "publish" | "withhold", reason?, shareReason? }` → per-student outcome list (e.g. skipped: no grades); one transaction per student so one failure doesn't block others; all audited.
- **Search:** `GET /api/search?q=` for ⌘K (students + assessments, permission-filtered, max 8 each).
- **Charts data:** `GET /api/dashboard` extended with monthly collection series and status/programme breakdowns.
- **Student account provisioning:** enrolling a student creates a `User` (role STUDENT, no password) + `ActivationToken`; staff see/copy the activation link (no email system — documented). Seed creates activated demo accounts.

### 5.7 Seed & demo

- Seed adds users: one per staff role + every seeded student activated, with demo passwords from `DEMO_PASSWORD` env (default documented in `.env.example`, e.g. `Demo@12345`). One student left as "invitation pending" to show the flow.
- Seed adds ~12 months of historical payments so the collection chart is meaningful, plus a few notifications.
- `/login` shows demo buttons only when `DEMO_MODE=true`.

### 5.8 Testing (G4)

- All v1 tests kept green (adapted where the session mechanism changes: test helpers mint real JWTs instead of the old cookie).
- New **unit**: password hashing/verify, JWT sign/verify/expiry/tamper, permission matrix, CSV escaping & injection, access rules for four roles, reminder idempotency rule.
- New **integration**: login success/failure/lockout/generic error, refresh rotation, **reuse detection revokes family**, logout, deactivation takes effect immediately, activation (expired/used tokens), change password revokes other sessions, permission matrix over every route, notifications created transactionally, bulk release partial outcomes, export content + injection, search permission filtering.
- **E2E:** keep the HTTP smoke suite (now logging in via `/api/auth/login`) **and add Playwright** browser tests for the headline flows (demo login per role, enrol student, record payment → balance updates, student upload, publish → student sees marks, ⌘K). Playwright also produces the README **screenshots**, and lets the builder visually verify the UI (the Chrome extension was unavailable in v1).

### 5.9 Documentation (G5)

- **README** rewritten for v2: live-demo/demo-login section first, screenshots, feature tour by role, architecture, security model, API table, testing, "How I used AI" (updated honestly), limitations.
- **ADRs** in `docs/adr/` (short: context, decision, consequences): 001 hand-rolled JWT + refresh rotation; 002 permission matrix & role split; 003 fee snapshot + FIFO overdue; 004 append-only payments; 005 server-side results filtering; 006 shadcn/ui and design direction; 007 deploy & storage strategy.
- **Private, git-ignored** `private-docs/` (added to `.gitignore` before creation; verified untracked):
  - `INTERVIEW_QA.md` — likely interview questions with strong answers (architecture, auth/security, data model, edge cases, testing, trade-offs, scaling, AI usage, "what would you do differently").
  - `CODEBASE_GUIDE.md` — full walkthrough: folder map, request lifecycle, every module and exported function (purpose, inputs/outputs, why it exists, edge cases it handles, which tests cover it).

### 5.10 Live demo & shared demo-account protection

**Decided by the user:** a hosted live demo, with **Neon** as the managed Postgres. The app host (Railway or Render, both support a persistent volume for `UPLOAD_DIR`) is created by the user at deploy time. Credentials go only into the host's environment settings, never into chat or git. **Neon Auth is not used**; Neon is the database only, and auth stays hand-written (§5.1).

Every reviewer shares the same demo accounts, so one reviewer must not be able to break the demo for the next. Users seeded with `isDemo = true` are protected:
- exempt from account lockout (the per-IP limiter still applies);
- cannot change their password, be deactivated, or be force-signed-out ("sign out everywhere" only ends *your own* other sessions);
- the UI shows a small "Demo account" badge and explains disabled actions.

These are server-side rules with tests. Hiding buttons alone is not enough.

**Data reset:** a `npm run demo:reset` script (re-runs the seed) runs nightly via the host's cron. The login page says "Demo data resets nightly". Mutations stay enabled so reviewers can try every flow.

**Deploy phase (inserted after priority 5):** `prisma migrate deploy` on release, production env validation (`JWT_SECRET`, `DATABASE_URL` with `sslmode=require`, `DEMO_MODE`, `DEMO_PASSWORD`, `UPLOAD_DIR` on the volume), the HTTP smoke and Playwright suites run against the live URL, and the URL goes at the top of the README.

## 6. Decided by the user
- Goal: maximise PEN submission impression and interview performance.
- Approach A (evolve on a branch) with hand-rolled JWT.
- Real JWT auth, shadcn/ui, redesign inspired by modern portals, more functionality.
- Private Q&A + full code walkthrough, not shared via git.
- Hosted live demo with Neon Postgres (§5.10); Neon Auth not used.

## 7. Builder's calls (decided here, correctable)
- Four roles and the permission matrix above.
- scrypt via `node:crypto` (no native deps); `jose` for JWT.
- Access 15 min / refresh 7 days; cookie names/attributes as above.
- Activation links instead of emailed invites; reminders as in-app notifications (no email).
- Playwright for browser E2E + screenshots.
- Demo buttons gated by `DEMO_MODE`.

- **Staff notifications too** (so the bell is never empty for staff): delivered to every active user holding the relevant permission. Events: late submission received → `grades.write` holders; results awaiting release (grade entered for a withheld student, at most one per student per day) → `results.release`; payment voided → `finance.read`; new student enrolled → `students.write`. Created in the same transaction as the triggering change. Seed includes a few unread ones per role.
- **Student login follows v1 policy:** WITHDRAWN / DEFERRED / COMPLETED students **can still sign in** to see fees, receipts and results (they owe money / need transcripts) but cannot submit — exactly as v1 enforces. Login is only blocked by `User.isActive = false`. `User.email` for a student **mirrors `Student.email`**: `updateStudent` updates both in one transaction (conflict on either → 409 on `email`).
- **Priority order (must-ship first)** — every phase ends green and mergeable:
  1. Auth + roles + permission matrix (+ adapted v1 tests)
  2. shadcn app shell, login with demo buttons, all existing v1 pages rebuilt
  3. Student 360° (tabs + timeline), dashboard charts, ⌘K search
  4. Notifications (student + staff), receipts, CSV export, bulk release
  5. Playwright flows + screenshots, README + ADRs
  5b. Deploy (Neon + app host) and live-URL verification (§5.10)
  6. Finance ledger + reminders, audit log page, users page / activation UI
  7. Private docs (`INTERVIEW_QA.md`, `CODEBASE_GUIDE.md`) — written last against the final code, before submission.
  If time runs short, cut from phase 6 backwards; never ship a half-built item.
- **Playwright is must-have** (phase 5): it is the only way the builder can visually verify the UI and it produces the README screenshots.

## 8. Left to the builder
- Exact component composition, file layout under `src/components`, chart styling details.
- Pagination sizes, debounce timings, copy text.
- Order of implementation within the plan (auth first is recommended, since every page depends on it).

## 9. Risks
- **Scope vs deadline:** the plan must be ordered so that each phase ends green and mergeable; if time runs short, drop from the end of the list (users page → audit page → reminders), never ship half a feature.
- **Middleware refresh redirects** can loop if misconfigured — covered by E2E.
- **Vercel-style hosting has no persistent disk** — local upload storage would be lost; ADR 007 documents using a host with a persistent volume or swapping the storage adapter.
