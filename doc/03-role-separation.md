# Task 03 — Role Separation (Staff / Student)

**Status:** ✅ Done
**Depends on:** 01, 02
**Estimate:** 0.25 day

## Goal
Two clearly separated experiences — **Staff (Registry)** and **Student** — switchable with a simple role toggle (full auth is optional and out of scope).

## Details
- A **role switcher** in the top navigation: `Staff` | `Student`.
- When `Student` is chosen, a dropdown selects **which student** to act as (seeded students).
- Store the selection in a **cookie** (`role`, `studentId`) so both Server Components and API routes can read it.
- A helper `getCurrentUser()` in `src/lib/session.ts` returns `{ role: 'STAFF' } | { role: 'STUDENT', studentId }`.
- **Next.js middleware** redirects:
  - Student → away from `/staff/*` pages.
  - Staff → away from `/me/*` pages (or allowed as "preview").
- **API routes enforce the role too**, not just the UI (e.g. a student cannot call `POST /api/grades`).
- Visible banner: "Viewing as: Staff" / "Viewing as: Jane Doe (SMS-2025-0001)".

## Page Map
| Staff | Student |
|---|---|
| `/staff/dashboard` | `/me` (profile + status) |
| `/staff/students` | `/me/fees` |
| `/staff/students/[id]` | `/me/assessments` |
| `/staff/assessments` | `/me/results` |
| `/staff/marksheet` | |

## Edge Cases
- Student cookie points to a student that no longer exists → reset to role picker.
- Student with status `WITHDRAWN` can still log in and view fees/results, but cannot submit work.

## Acceptance Criteria
- [ ] Toggle switches role without a page error.
- [ ] Students cannot see other students' data (API checks `studentId` from session).
- [ ] Staff-only API routes return `403` for the student role.
- [ ] README explains that auth is simulated and why.
