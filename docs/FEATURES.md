# Features

A tour of everything the Registry module does, organised by who uses it. Each feature notes the edge cases it handles. For how it is built, see [ARCHITECTURE.md](./ARCHITECTURE.md).

**Try it:** run the app with `DEMO_MODE=true` and use the one-click demo cards on the sign-in page.

| Demo account | Role | What to try |
|---|---|---|
| `admin@demo.sms` | Registry Admin | Everything: enrolment, finance, marking, results release |
| `finance@demo.sms` | Finance Officer | Overdue balances, record and void payments, add charges |
| `academic@demo.sms` | Academic Staff | Create assessments, review submissions, enter marks |
| `amelia.clarke@student.example.ac.uk` | Student | Coursework upload, fees statement, published results |

All demo passwords are `DEMO_PASSWORD` (default `Demo@12345`). Other seeded students (e.g. `hannah.lee@…`, withdrawn and overdue) sign in the same way.

---

## 1. Sign-in and accounts (everyone)

| Feature | Details |
|---|---|
| **Sign in** | Email and password. The message is always "Email or password is incorrect", so it never reveals which accounts exist. Email case and spaces don't matter. |
| **One-click demo sign-in** | Four role cards on the sign-in page (only when `DEMO_MODE=true`). |
| **Stay signed in** | 15-minute access token with silent refresh. A form submitted after a long break still saves (the token is refreshed and the request retried). If the session has truly ended, you're sent back to the page you were on after signing in again. |
| **Lockout** | 5 wrong passwords → 15-minute lock. Logins are also rate-limited per IP. |
| **Account page** | Profile, change password (signs out your other devices), list of active sessions with "Sign out other sessions". |
| **Student activation** | Enrolling a student creates their portal account with a single-use, 72-hour activation link. The student sets a password at `/activate`. Expired or used links explain what to do next. |
| **Shared demo accounts are protected** | They can't be locked, have their password changed, or sign out other reviewers, and each reviewer only sees their own session. |

## 2. App shell (staff and students)

- **Navigation:** a collapsible sidebar grouped by area (Overview · Students · Academic). It shows **only what your role can use**, and becomes a slide-out sheet on phones.
- **Top bar:** breadcrumbs (student and assessment names, not ids), a **Light / Dark / System** theme switch, and a user menu with a "Demo account" badge.
- **Feedback:** every action shows a pending state and a success or error toast. Errors include a **request reference** you can quote to support.
- **Resilience:**
  - If the database is down you see an outage notice, not a sign-out.
  - Unknown records return a real 404 page.

---

## 3. Registry staff

### Dashboard — `/staff`
- **Greeting and KPI cards:** enrolled students, overdue balances (count and £), results awaiting release, outstanding fees, deadlines this week. Each card links to its list.
- **Work queues, most urgent first:**
  - overdue balances (oldest debt first, days overdue, a **Record payment** shortcut)
  - results awaiting release
  - deadlines in the next 7 days, with outstanding counts
  - recent late submissions
- **Credit note:** a notice when money is held as credit from overpayments.
- **Role-shaped:** Finance sees only the money queues; Academic sees only coursework; the Registry Admin sees all of it.

### Students — `/staff/students`
- **Search** by name, Student ID or email (as you type). **Filter** by programme and status.
- **Sort** by Student ID, name or academic year.
- **Paging:** 20, 50 or 100 per page, plus a **column picker** that's remembered in your browser.
- **Shareable links:** filters, sort and page are in the URL.
- **Bad links are safe:** a hand-edited link with invalid filters shows a notice and falls back to defaults. A page past the end offers "Go to first page".
- **Finance columns** (balance, fees status) appear only for roles with finance access. The figures aren't even sent to other roles' browsers.
- **Enrol student** opens a side panel:
  - The Student ID is generated automatically (`SMS-2025-0001`), unique even under concurrent enrolment.
  - The programme fee is assigned automatically, shown as you pick the programme.
  - Validation: date of birth (≥ 16, not in the future), academic year format, unique email (case-insensitive).
  - After saving, the **activation link is shown once** with a Copy button.

### Student record — `/staff/students/:id`
- **Header:** initials, name, Student ID, programme and year, with badges for enrolment status, fees status and portal account.
- **Tabs (linkable with `?tab=`)**, each shown only to roles allowed to see it:
  - **Overview:** alerts (overdue, withdrawn but owing, results withheld), personal details, the **status editor** (with warnings about what each change means), and the portal account with "Generate activation link".
  - **Finance:**
    - Totals: total fees, paid, outstanding or credit, overdue since.
    - **Charges**, with **Add charge** for resits or late fees.
    - **Payments**, with **Record payment**. Duplicate references are rejected, and paying more than the balance gives a warning and becomes credit.
    - **Void** a payment with a required reason. It's never deleted: it stays visible, struck through, with the reason.
  - **Coursework:** every submission with its time, version, Late flag and download.
  - **Results:** the marksheet with classification, average and overall classification, and **Publish** / **Withhold** (with a reason, optionally shown to the student).
  - **Activity:** an audit trail of every change, filtered by role (no payment entries for academics, no marks for finance).

### Assessments — `/staff/assessments`
- **List:** deadline with relative time, open / closing soon / closed badge, submitted, late and missing counts.
- **Create assessment** (title, module, deadline in your local time). It warns if the deadline is already in the past.
- **Roster** for each assessment:
  - On time / Late / Not submitted / Graded totals. **Click a total to filter the roster.**
  - Each student's submission time, version, file and results status.
  - **Inline marking:** type a mark and press Enter or click away. The classification badge updates as you type and a ✓ confirms the save. It warns when marking a student who hasn't submitted.
  - **Deadline editor.** Extending a deadline doesn't un-flag work that was already late.

### Results release — `/staff/results`
- Switch between **All graded** and **Awaiting release** (with a count).
- Each row shows grades count, release status, the withhold reason and a "Fees overdue" flag.
- **Publish** or **Withhold** per student from the row. When fees are overdue, the withhold popup suggests "Outstanding tuition fees".
- Results **default to withheld**, and a student with no grades can't be published.

---

## 4. Students — `/me`

| Page | What the student sees |
|---|---|
| **Home** | Greeting; alerts for overdue fees, deadlines **under 48 hours** with no submission, and newly published results. Balance, work-to-submit and results cards. Upcoming deadlines with countdowns ("Due in 2 days"). |
| **Coursework** | One card per assessment: open / closing / closed, countdown, current file and version, then a **drag-and-drop upload** with an instant file check (PDF/DOCX, size) and a **progress bar**. After the deadline, a warning appears *before* submitting that the work will be flagged late and can't be replaced. Students who aren't enrolled are told why they can't submit. |
| **Fees** | A **statement** of charges and payments in date order with a running balance (credit shown as credit). Overdue and credit notices, and totals. |
| **Results** | If withheld: a lock screen, with the reason only if staff chose to share it. **No marks are sent to the browser.** If published: the marksheet, average and classification, and a **Print** button that prints without the app chrome. |
| **Account** | Change password, sessions. |

---

## 5. Rules worth knowing

| Area | Rule |
|---|---|
| Student IDs | `SMS-{intake year}-{sequence}`, generated inside the enrolment transaction, never reused |
| Fees | The programme fee is **snapshotted** at enrolment, so a later price change doesn't rewrite what existing students owe. Due 30 days after enrolment by default. |
| Overdue | Payments are applied to the **oldest charge first**; overdue means unpaid money on a charge past its due date |
| Payments | Append-only. Mistakes are voided with a reason. References are unique. |
| Submissions | Resubmit freely before the deadline. After it: one late submission is allowed if nothing was submitted, otherwise the upload is refused. Files are checked by content, not just extension. |
| Classification | Fail < 40 ≤ Pass < 60 ≤ Merit < 70 ≤ Distinction |
| Results | Withheld by default. Publishing and withholding are per student, audited, and filtered on the server. |

The full reasoning behind each rule is in the [README](../README.md#product-decisions--edge-cases).
