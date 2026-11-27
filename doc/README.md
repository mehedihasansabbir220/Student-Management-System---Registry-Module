# Task Index — Student Management System (Registry Module)

Source requirements: [`../requirement.md`](../requirement.md)

Each task has its own file with: **Goal, Scope, Details, Data/API/UI, Edge Cases, Acceptance Criteria, Dependencies, Status**.
Update the **Status** column here (and in each file) as work progresses.

| # | Task | File | Depends on | Status |
|---|---|---|---|---|
| 01 | Project Setup | [01-project-setup.md](./01-project-setup.md) | — | ⬜ Not started |
| 02 | Database Schema (Prisma) | [02-database-schema.md](./02-database-schema.md) | 01 | ⬜ Not started |
| 03 | Role Separation (Staff / Student) | [03-role-separation.md](./03-role-separation.md) | 01, 02 | ⬜ Not started |
| 04 | Student Enrolment | [04-student-enrolment.md](./04-student-enrolment.md) | 02, 03 | ⬜ Not started |
| 05 | Fees & Payments | [05-fees-and-payments.md](./05-fees-and-payments.md) | 04 | ⬜ Not started |
| 06 | Assessment Submission | [06-assessment-submission.md](./06-assessment-submission.md) | 04 | ⬜ Not started |
| 07 | Marksheet & Results | [07-marksheet-and-results.md](./07-marksheet-and-results.md) | 06 | ⬜ Not started |
| 08 | Registry Dashboard | [08-registry-dashboard.md](./08-registry-dashboard.md) | 05, 06, 07 | ⬜ Not started |
| 09 | Seed Script | [09-seed-script.md](./09-seed-script.md) | 02 (grows with 04–07) | ⬜ Not started |
| 10 | Validation & Error Handling | [10-validation-and-error-handling.md](./10-validation-and-error-handling.md) | cross-cutting | ⬜ Not started |
| 11 | Testing & QA | [11-testing-and-qa.md](./11-testing-and-qa.md) | 04–08 | ⬜ Not started |
| 12 | README, AI Usage & Submission | [12-readme-and-submission.md](./12-readme-and-submission.md) | all | ⬜ Not started |

Status legend: ⬜ Not started · 🟨 In progress · ✅ Done

## Suggested Order (7 working days)

| Day | Focus |
|---|---|
| 1 | 01 Setup, 02 Schema, 09 Seed (skeleton), 03 Role toggle |
| 2 | 04 Student Enrolment |
| 3 | 05 Fees & Payments |
| 4 | 06 Assessment Submission |
| 5 | 07 Marksheet & Results |
| 6 | 08 Dashboard, 10 Validation polish, finish 09 Seed |
| 7 | 11 Testing & QA, 12 README + AI usage, final push |

## Key Product Decisions (summary)

Recorded here so the README can reuse them. Details live in each task file.

1. **Student ID** — `SMS-<intake year>-<4-digit sequence>`, sequence resets per year, generated inside a DB transaction so it can never collide. IDs are never reused, even if a student is withdrawn.
2. **Fees** — Fee amount lives on the **Programme**; when a student is enrolled a **fee record is created that snapshots the amount + due date**, so a later programme price change does not silently rewrite what existing students owe.
3. **Balance** — always computed (`fee − sum(payments)`), never stored, so it is "real time" by definition.
4. **Overdue** — balance > 0 **and** due date has passed. Withdrawn students with a balance are still flagged (debt still exists).
5. **Resubmission** — before the deadline it replaces the previous file. After the deadline, a student with **no** submission may submit (flagged **Late**); a student who already submitted on time **cannot** overwrite it.
6. **Results visibility** — publishing is per student. Withheld results can carry a reason (e.g. "outstanding fees", "academic misconduct review"). Students only ever see published grades.
7. **Money** — stored as `Decimal(10,2)`, never float.
