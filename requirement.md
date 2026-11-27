# Technical Assessment — Student Management System (Registry Module)

| Item | Detail |
|---|---|
| **Tech Stack** | Next.js (App Router) · PostgreSQL · Prisma ORM |
| **Submission** | GitHub repository + README |
| **Time Allowed** | Within 7 working days |
| **AI Usage** | Encouraged — document what you used and how |

---

## Overview

Build a focused web application covering the core **Registry** function of a student management system. This is **not** a full platform — it covers the four workflows a Registry Administrator uses every day.

> We care more about how you think than how much you build. Make deliberate product decisions, handle edge cases, and document your reasoning. Use AI tools freely — but own the output.

---

## What to Build

### 1. Student Enrolment
The Registry team needs to add and manage student records.

- Create a student record: **full name, email, date of birth, programme, academic year, enrolment status**.
- Auto-generate a unique **Student ID** (e.g. `SMS-2025-0001`).
- Enrolment statuses: **Enrolled, Deferred, Withdrawn, Completed**.
- Search and filter students by **name, ID, programme, or status**.

### 2. Fees & Payments
The Registry needs to track what each student owes and what they have paid.

- Assign a **fee amount** to each student based on their **programme**.
- Record **payment transactions**: amount, date, and reference number.
- Show **outstanding balance in real time**.
- **Flag students with an overdue balance** on the Registry dashboard.

### 3. Assessment Submission
Students submit work against assessments created by staff.

- Staff creates an assessment: **title, module, and submission deadline**.
- Students **upload a file (PDF or DOCX)** against an open assessment.
- **One submission per student per assessment**; allow **resubmission before the deadline**.
- **Late submissions are accepted but visually flagged.**

### 4. Marksheet & Results
Staff enter grades; students see results only when published.

- Staff enter a **numeric grade (0–100)** per student per assessment.
- Apply a simple classification: **Pass ≥ 40, Merit ≥ 60, Distinction ≥ 70**.
- Staff can **publish or withhold** results **per student**.
- Students see their marksheet **only after it has been published**.

---

## What to Submit

- A **GitHub repository** with all code committed (no zip files).
- A **README** covering:
  - how to run it locally,
  - your `.env` variables,
  - a short section on **how you used AI** during the build.
- A **seed script** that loads demo data: at least **5 students, 2 programmes, fees, and sample grades**.
- **Basic role separation**: a **Staff view** and a **Student view** (auth optional — a simple role toggle is fine).

---

## How We Will Assess It

| Dimension | What it means | Weight |
|---|---|---|
| **Stakeholder understanding** | Does your data model and UI reflect how a Registry team actually works? | **30%** |
| **Feature intuition** | Did you handle edge cases (overdue fees, late submissions, withheld results) without being told to? | **30%** |
| **Technical quality** | Clean schema, working API routes, basic error handling. | **25%** |
| **AI usage** | Did you use AI effectively, and can you articulate how in your README? | **15%** |

---

## Task Breakdown

Detailed task documents live in [`doc/`](./doc/README.md). Start with [`doc/README.md`](./doc/README.md) for the task index, order, and status.

---
---

# Delivery notes (added by the candidate, not part of the brief)

Everything above this line is the original brief, unchanged. This section maps each requirement to what was built, then lists what was added beyond the brief and **why**.

## Requirement coverage

| Brief requirement | How it is met | Where |
|---|---|---|
| Create a student record (name, email, DOB, programme, year, status) | Enrol side panel with validation (age ≥ 16, real dates, `YYYY/YY` years, unique email) | `/staff/students` → Enrol student |
| Auto-generated unique Student ID | `SMS-{intake year}-{seq}`, incremented atomically inside the enrolment transaction (tested with 10 concurrent creates) | `src/domain/student-number.ts`, `services/students.ts` |
| Statuses Enrolled / Deferred / Withdrawn / Completed | Status editor with consequence warnings; leaving is a status, records are never deleted | Student record → Overview |
| Search & filter by name, ID, programme, status | Live search plus faceted filters, sort and paging, all in the URL | `/staff/students` |
| Fee per student based on programme | Programme fee **snapshotted** onto the student at enrolment; extra charges supported | Student record → Finance |
| Record payments (amount, date, reference) | Record payment dialog; references unique; payments voided with a reason, never deleted | Student record → Finance |
| Outstanding balance in real time | Balance is never stored: always computed from charges minus valid payments | everywhere balances appear |
| Flag overdue balances on the dashboard | Overdue queue (oldest debt first, FIFO allocation) and KPI card | `/staff` |
| Staff create assessment (title, module, deadline) | Create dialog; deadline entered in local time, stored as an instant | `/staff/assessments` |
| Students upload PDF/DOCX | Drag-and-drop upload with progress; checked by file **content**, not just extension | `/me/assessments` |
| One submission per student, resubmit before deadline | Unique (assessment, student); resubmission replaces the file and bumps the version | `services/submissions.ts` |
| Late submissions accepted but flagged | One late submission allowed if nothing was submitted; flagged everywhere; extending the deadline doesn't rewrite it | roster, student record, portal |
| Numeric grade 0–100 per student per assessment | Inline marking on the roster with a live classification preview; DB CHECK 0–100 | `/staff/assessments/:id` |
| Pass ≥ 40, Merit ≥ 60, Distinction ≥ 70 | One `classify()` shared by server and UI, tested at every boundary | `src/domain/grades.ts` |
| Publish / withhold per student | Per-student controls with a reason (optionally shared); **default withheld** | `/staff/results`, Student record → Results |
| Students see marks only after publication | Filtered on the **server**: a withheld response contains no marks at all | `/me/results`, `services/results.ts` |
| README (run locally, `.env`, AI usage) | Quick start, env table, "How I used AI" | `README.md` |
| Seed: ≥ 5 students, 2 programmes, fees, grades | 8 students (each showing an edge case), 2 programmes, 4 modules, 5 assessments, fees, payments, grades, demo staff accounts | `prisma/seed*.ts` |
| Basic role separation (staff / student view) | Real sign-in with **four** roles and a permission matrix enforced on every route and page | `src/domain/permissions.ts` |

## What we added beyond the brief, and why

| Addition | Why |
|---|---|
| **Real authentication** instead of a role toggle: JWT access tokens, rotating refresh tokens with reuse detection, lockout, rate limiting, activation links, session list | The brief allowed a toggle, but a Registry holds personal and financial data. Real auth shows how access would actually be controlled, and every line is hand-written so it can be explained. |
| **Four roles** (Registry Admin, Finance, Academic, Student) with one permission matrix | This is how a real Registry team splits work: Finance handles money but not marks, academics mark but don't release results. The same matrix drives the API, the pages, the navigation and the dashboard, so they can't disagree. |
| **Shared demo accounts protected** (can't be locked, have their password changed, or sign other reviewers out) | Every reviewer uses the same demo logins. One reviewer must not be able to break the demo for the next. |
| **Audit trail** on every change, written in the same transaction | Registries are audited. "Who voided this payment and why?" must always have an answer. |
| **Append-only payments** (void with a reason, never delete) | Financial records must not disappear. A bounced cheque is a fact worth keeping. |
| **Fee snapshot and FIFO overdue** | A price change shouldn't silently change what existing students owe, and a student who has paid last term shouldn't be flagged because of a fee due next month. |
| **Withheld by default, filtered on the server** | Results becoming visible by accident is the worst failure here. Hiding marks only in the browser would leak them to anyone reading the network tab. |
| **File checks by content** and safe downloads | Uploaded files are untrusted. A renamed `.exe` must not be stored as a "PDF". |
| **Professional UI** (shadcn/ui): role-aware sidebar, dark mode, mobile layout, shareable table links, inline marking, drag-and-drop upload with progress, deadline countdowns, fees statement, printable results | The brief weights stakeholder understanding at 30%. Staff use this all day, so speed and clarity matter: inline marking instead of a form per grade, a dashboard that starts with what's urgent, links that can be pasted to a colleague. |
| **Typed errors, request ids, structured logs** | When a user reports "it failed", the reference on their screen leads to one log line. |
| **DB constraints** (unique + CHECK) as a last line of defence | Rules in code can be bypassed by a bug or a script; the database refuses bad data regardless. |
| **Four test suites** (unit, integration on real Postgres, HTTP E2E, Playwright browser incl. every write flow) written test-first, plus CI | Edge cases are only handled if a test proves it. CI keeps every change green. |
| **Architecture and features documentation** | So a reviewer can understand the system in minutes: [docs/ROLES.md](./docs/ROLES.md) (each role's features mapped to the code), [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), [docs/FEATURES.md](./docs/FEATURES.md). |

Deliberately **not** built (see the README's limitations): email/SMS delivery, payment gateways, SSO, cloud file storage, admissions, timetabling and attendance. They're outside the Registry workflows the brief describes.
