# Task 04 — Student Enrolment

**Status:** ✅ Done
**Depends on:** 02, 03
**Estimate:** 1 day
**Requirement ref:** requirement.md §1

## Goal
Registry staff can create, view, edit and find student records, each with an auto-generated unique Student ID.

## Requirements
- Create student: full name, email, date of birth, programme, academic year, enrolment status.
- Auto-generate Student ID, e.g. `SMS-2025-0001`.
- Statuses: Enrolled, Deferred, Withdrawn, Completed.
- Search & filter by name, ID, programme, status.

## Details

### Student ID generation
- Format: `SMS-{intakeYear}-{sequence padded to 4}`.
- Inside a `prisma.$transaction`: upsert `StudentIdSequence` for the year, increment `lastValue`, then create the student.
- Unique constraint on `studentNumber` as a safety net; retry once on conflict.
- IDs are **never reused**.

### On create (side effects)
- Create the initial **Fee** record from the programme's `feeAmount` (see Task 05).
- Create a **ResultRelease** row with status `WITHHELD`.

### API routes
| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/students?q=&programmeId=&status=&page=` | List + search + filter (paginated) |
| `POST` | `/api/students` | Create |
| `GET` | `/api/students/[id]` | Detail (incl. balance, submissions, grades) |
| `PATCH` | `/api/students/[id]` | Update details / status |
| `GET` | `/api/programmes` | For dropdowns |

### UI
- `/staff/students` — table: Student ID, name, programme, year, status badge, balance, overdue flag.
  - Search box (matches name **or** Student ID, case-insensitive, partial).
  - Filters: programme, status. Filters reflected in URL query string (shareable/bookmarkable).
  - Empty state: "No students match your filters" + clear filters button.
- `/staff/students/new` — form.
- `/staff/students/[id]` — profile with tabs: Details · Fees · Submissions · Results.

## Edge Cases
- Duplicate email → `409` with friendly message.
- Date of birth in the future or student younger than 16 → validation error.
- Academic year format validated (`YYYY/YY`, consecutive years).
- Status change to `WITHDRAWN` → confirm dialog; student can no longer submit; outstanding balance remains.
- Status change to `COMPLETED` while balance outstanding → allowed but warning shown.
- Changing programme → asks whether to adjust fees (does **not** silently change existing fee records).
- Concurrent creates do not produce duplicate IDs.

## Acceptance Criteria
- [ ] Staff can create a student and sees the generated ID.
- [ ] Two students created in the same year get sequential IDs.
- [ ] Search by partial name and by ID works; filters combine (AND).
- [ ] Validation errors shown inline on the form.
- [ ] Status badges are colour-coded and consistent across the app.
