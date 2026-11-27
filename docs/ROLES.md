# Roles guide

What each role can do, and **where each feature lives in the code**, so a reviewer can follow any feature from the screen to the database.

Every row follows the same path:

```
Screen (src/app/…)  →  API route (src/app/api/…)  →  guard (permission)  →  service (src/server/services/…)  →  domain rule (src/domain/…)
```

Permissions come from one matrix in [`src/domain/permissions.ts`](../src/domain/permissions.ts). The same matrix decides the sidebar ([`src/lib/nav.ts`](../src/lib/nav.ts)), dashboard sections ([`src/lib/dashboard-sections.ts`](../src/lib/dashboard-sections.ts)) and student-record tabs ([`src/lib/student-tabs.ts`](../src/lib/student-tabs.ts)). Every API route checks again on the server.

| | Registry Admin | Finance Officer | Academic Staff | Student |
|---|:-:|:-:|:-:|:-:|
| Demo account | `admin@demo.sms` | `finance@demo.sms` | `academic@demo.sms` | `amelia.clarke@student.example.ac.uk` |
| Home | `/staff` | `/staff` | `/staff` | `/me` |
| Students list & record | ✅ | ✅ | ✅ | |
| Enrol / change status / activation links | ✅ | | | |
| See balances, charges, payments | ✅ | ✅ | | own only |
| Record / void payments, add charges | ✅ | ✅ | | |
| Create assessments, see submissions, mark | ✅ | | ✅ | |
| Publish / withhold results | ✅ | | | |
| Upload coursework, see own results | | | | ✅ |

---

## 1. Everyone (signed in)

| Feature | Screen | API | Code |
|---|---|---|---|
| Sign in (one-click demo cards when `DEMO_MODE=true`) | `src/app/(auth)/login/` | `POST /api/auth/login` | `services/auth.ts → login()` · lockout, dummy-hash timing · `server/auth/rate-limit.ts` |
| Stay signed in (silent refresh) | — | `POST /api/auth/refresh` | `services/auth.ts → refresh()` (rotation + reuse detection) · `lib/api-client.ts` retries once · `middleware.ts` for page loads |
| Sign out | user menu | `POST /api/auth/logout` | `services/auth.ts → logout()` |
| Activate account (students) | `src/app/(auth)/activate/` | `POST /api/auth/activate` | `services/auth.ts → activate()` |
| Change password | `/staff/account`, `/me/account` | `POST /api/auth/change-password` | `services/auth.ts → changePassword()` (signs out other sessions) |
| See / end other sessions | same | `GET` / `DELETE /api/auth/sessions` | `listSessions()` / `revokeOtherSessions()`; demo accounts only see their own session and can't end others |
| App shell: sidebar, breadcrumbs, theme, user menu | every page | — | `src/components/shell/*` · `lib/nav.ts` · `lib/breadcrumbs.ts` |

---

## 2. Registry Admin: runs the Registry

Holds **every** permission. Their day is enrolments, chasing problems on the dashboard, and the final decision on releasing results.

### Dashboard: `/staff`
| What they see | Code |
|---|---|
| KPI cards: enrolled, overdue balances, results awaiting release, outstanding fees, deadlines this week | `src/app/staff/page.tsx` · `services/dashboard.ts → getDashboard()` |
| Queues: overdue balances (oldest debt first), results awaiting release, deadlines in the next 7 days, recent late submissions | order and visibility: `lib/dashboard-sections.ts` · overdue maths: `domain/fees.ts` (FIFO allocation) |

### Students: `/staff/students`
| Action | Screen | API (permission) | Service / rule |
|---|---|---|---|
| Search, filter, sort, page (all in the URL) | `staff/students/page.tsx`, `students-table.tsx`, `components/data-table/*` | `GET /api/students` (`students.read`) | `services/students.ts → listStudents()` · URL state: `lib/table-state.ts` |
| **Enrol a student** → Student ID, fee snapshot, portal account + activation link | `enrol-student-sheet.tsx` | `POST /api/students` (`students.write`) | `createStudent()` · ID: `domain/student-number.ts` · fee snapshot, audit, activation token in one transaction |

### Student record: `/staff/students/:id`
| Action | Tab / component | API (permission) | Service / rule |
|---|---|---|---|
| View profile, alerts, portal account | Overview · `page.tsx`, `student-header.tsx` | — (server component) | `getStudent()` |
| **Change status** (with consequence warnings) | Overview · `status-editor.tsx` | `PATCH /api/students/:id` (`students.write`) | `updateStudent()` |
| **Issue a new activation link** | Overview · `portal-account.tsx` | `POST /api/students/:id/activation-link` (`students.write`) | `services/auth.ts → issueActivationLink()` |
| Finance tab | see Finance Officer below | | |
| Coursework and marks | see Academic Staff below | | |
| **Publish / withhold results** | Results · `release-controls.tsx` | `POST /api/students/:id/results/publish` · `…/withhold` (`results.release`) | `services/results.ts → publishResults()` / `withholdResults()` |
| Activity (audit trail) | Activity | — | audit rows written by every service in the same transaction (`server/audit.ts`) · role filter: `lib/activity.ts` |

### Results release: `/staff/results`
| Action | Code |
|---|---|
| All graded / awaiting release, "Fees overdue" flag per row | `staff/results/page.tsx` · `lib/release-filter.ts` · `services/results.ts → listReleaseOverview()` |
| Publish / withhold from the row | reuses `release-controls.tsx` (compact) |

**Rules they rely on:**
- Results are **withheld by default**, and a student with no grades can't be published.
- Withholding needs a reason, and staff choose whether the student sees it.
- Withdrawn students stay on the overdue list.

---

## 3. Finance Officer: money only

Permissions: `dashboard.read, students.read, finance.read, fees.write, payments.write, payments.void, reminders.send`. **No access to marks, submissions or results.** The Results tab, Coursework tab and Results release page don't exist for them, and those routes return 403.

| Action | Screen | API (permission) | Service / rule |
|---|---|---|---|
| Dashboard: overdue balances and outstanding fees only | `/staff` | — | `dashboardSectionsFor("FINANCE")` → `["overdue"]` |
| Students list with **Balance** and **Fees** columns | `/staff/students` | `GET /api/students` | Balances are only sent to roles with `finance.read` (`staff/students/page.tsx`) |
| Account summary, charges, payments | record → Finance | `GET /api/students/:id/fees` (`finance.read`) | `services/fees.ts → getAccount()` · `services/accounts.ts → accountFor()` |
| **Record a payment** (overpayment warning → credit) | `payment-dialog.tsx` | `POST /api/students/:id/payments` (`payments.write`) | `recordPayment()` · unique reference (409 on the field) · money as integer pence: `domain/money.ts` |
| **Void a payment** with a reason (never deleted) | `void-payment.tsx` | `POST /api/payments/:id/void` (`payments.void`) | `voidPayment()` · voiding twice is rejected atomically |
| **Add a charge** (resit, late fee) | `add-fee-dialog.tsx` | `POST /api/students/:id/fees` (`fees.write`) | `addFee()` |

**Rules they rely on:**
- **The balance is never stored;** it's always computed.
- Payments clear the **oldest charge first**, so a fee that isn't due yet never counts as overdue.
- Fees are **snapshotted** at enrolment, so a price change doesn't rewrite existing debts.

---

## 4. Academic Staff: coursework and marking

Permissions: `dashboard.read, students.read, assessments.write, submissions.read, grades.write, results.read`. They **can't see money** (no Finance tab, no balance columns, no payment entries in Activity) and **can't release results**. Releasing is a Registry decision.

| Action | Screen | API (permission) | Service / rule |
|---|---|---|---|
| Dashboard: deadlines this week and late submissions | `/staff` | — | `dashboardSectionsFor("ACADEMIC")` → `["deadlines","late"]` |
| Assessments list with submitted / late / missing counts | `/staff/assessments` | `GET /api/assessments` (`submissions.read`) | `services/assessments.ts → listAssessmentsForStaff()` |
| **Create an assessment** (deadline in local time) | `create-assessment-dialog.tsx` | `POST /api/assessments` (`assessments.write`) | `createAssessment()` · local ↔ ISO: `lib/datetime-local.ts` |
| Roster: on time / late / missing (click to filter) | `/staff/assessments/:id` | `GET /api/assessments/:id` | `getAssessmentRoster()` · filter: `lib/roster.ts` |
| **Change the deadline** (late flags don't change) | `deadline-editor.tsx` | `PATCH /api/assessments/:id` (`assessments.write`) | `updateAssessment()` |
| Download a submission | roster, record → Coursework | `GET /api/submissions/:id/file` (`submissions.read`) | `services/submissions.ts → readSubmissionFile()` · always `attachment` + `nosniff` |
| **Enter a mark** inline, with a live classification | `grade-cell.tsx`, `classification-preview.tsx` | `PUT /api/grades` (`grades.write`) | `services/results.ts → enterGrade()` · `domain/grades.ts → classify()` (same function in the UI) |
| View a student's marksheet | record → Results | `GET /api/students/:id/results` (`results.read`) | `getStaffMarksheet()` |

**Rules they rely on:**
- Fail < 40 ≤ Pass < 60 ≤ Merit < 70 ≤ Distinction.
- Marking a student with no submission is allowed but warned.
- Changing a mark after publication is audited.

---

## 5. Student: their own record only

No staff permissions. Everything is scoped to the signed-in student by `requireStudent()` and the `/api/me/*` routes, so a student can never read another student's data.

| Action | Screen | API | Service / rule |
|---|---|---|---|
| Home: alerts (overdue fees, deadline < 48 h, results published), balance, work to submit, upcoming deadlines | `/me` · `src/app/me/page.tsx` | — | `getStudent()`, `listAssessmentsForStudent()`, `getStudentResults()` · `lib/countdown.ts` |
| Coursework: countdown, current file and version | `/me/assessments` | `GET /api/me/assessments` | `listAssessmentsForStudent()` · window rules: `domain/submissions.ts` |
| **Upload** (drag and drop, progress, instant file check, late warning before submitting) | `upload-form.tsx` | `POST /api/assessments/:id/submissions` | `submitAssessment()` · client check: `lib/upload.ts` · server check by content: `domain/file-type.ts` · storage: `server/storage.ts` |
| Fees statement with running balance | `/me/fees` | `GET /api/me/fees` | `getAccount()` · `lib/statement.ts` |
| Results, or a lock screen while withheld (print button) | `/me/results` | `GET /api/me/results` | `getStudentResults()`: **when withheld, no marks leave the server** |

**Rules they rely on:**
- Resubmit freely before the deadline. After it, one late submission is allowed if nothing was submitted.
- Students who aren't `ENROLLED` can view their record but can't submit. Withdrawn students can still sign in to see their fees and results.

---

## Where it's tested

| Role behaviour | Test |
|---|---|
| Every route × every role (401/403/allowed) | `tests/integration/permissions-matrix.test.ts` |
| Navigation, dashboard and tabs per role | `tests/unit/lib/nav.test.ts`, `dashboard-sections.test.ts`, `student-tabs.test.ts`, `activity.test.ts` |
| Sign-in, refresh, lockout, activation, demo protection | `tests/integration/auth-*.test.ts` |
| Each role in a real browser | `tests/browser/smoke.spec.ts` (every page per role), `tests/browser/flows.spec.ts` (enrol, pay, create + mark, upload, publish → student sees marks) |
