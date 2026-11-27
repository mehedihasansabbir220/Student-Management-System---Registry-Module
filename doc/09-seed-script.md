# Task 09 — Seed Script

**Status:** ✅ Done
**Depends on:** 02 (extended as 04–07 are built)
**Estimate:** 0.5 day

## Goal
`npx prisma db seed` loads realistic demo data that exercises **every edge case** so reviewers can see them immediately.

## Minimum (required)
- ≥ **5 students**, ≥ **2 programmes**, **fees**, **sample grades**.

## Planned Data
| Data | Content |
|---|---|
| Programmes | `BSC-CS` BSc Computer Science (£9,250), `BA-BUS` BA Business Management (£8,500) |
| Modules | 2–3 per programme |
| Students (≈8) | Mix of statuses: Enrolled ×4, Deferred ×1, Withdrawn ×1, Completed ×2; across both programmes and two academic years |
| Fees | One per student from programme fee; due dates mixed past/future |
| Payments | Paid in full · part paid (not overdue) · part paid **overdue** · nothing paid **overdue** · **overpaid (credit)** |
| Assessments | Past deadline, closing soon (<48h), future deadline |
| Submissions | On time · resubmitted (version 2) · **late** · missing. Small placeholder PDF files generated into `UPLOAD_DIR` |
| Grades | Covering Fail (35), Pass boundary (40), Merit (60/65), Distinction (70/82) |
| Result release | Some **published**, some **withheld** (one with reason "Outstanding fees") |

## Details
- `prisma/seed.ts`, run with `tsx`; configured in `package.json` → `"prisma": { "seed": "tsx prisma/seed.ts" }`.
- **Idempotent**: clears tables in dependency order before inserting (or `prisma migrate reset`).
- Uses the same Student ID generator as the app (not hard-coded IDs).
- Dates computed relative to "today" so overdue/late states always look right whenever reviewers run it.
- Prints a summary table at the end (which seeded student demonstrates which edge case).

## Acceptance Criteria
- [ ] `npx prisma migrate reset` (or `npm run db:seed`) runs without errors on a fresh DB.
- [ ] Dashboard shows at least one overdue student, one late submission, one withheld result after seeding.
- [ ] README lists the demo students and what each one demonstrates.
