# Task 11 — Testing & QA

**Status:** ⬜ Not started
**Depends on:** 04–08
**Estimate:** 0.5 day

## Goal
Confidence that the business rules are right, especially at the edges the assessors will probe.

## Automated (Vitest)
Unit tests for pure domain logic in `src/lib/domain/`:
- [ ] `classify(mark)` — 0, 39.99, 40, 59.99, 60, 69.99, 70, 100; rejects −1 and 101.
- [ ] `calculateBalance(fees, payments)` — none paid, partial, exact, overpaid (credit).
- [ ] `isOverdue(...)` — due today vs yesterday, zero balance with past due date.
- [ ] `formatStudentNumber(year, seq)` — padding (`0001`, `0123`, `9999`).
- [ ] `evaluateSubmission(...)` — every row of the rules table in Task 06.

Optional: a few API integration tests against a test database.

## Manual QA Checklist
- [ ] Create student → ID generated → fee created → appears in search.
- [ ] Filters combine correctly; clearing filters restores list.
- [ ] Record payment → balance updates; duplicate reference rejected.
- [ ] Overdue student shows on dashboard.
- [ ] Upload PDF and DOCX; reject `.png` and renamed files; reject > 10 MB.
- [ ] Resubmit before deadline; blocked after deadline; late first submission flagged.
- [ ] Enter grades; boundaries classify correctly.
- [ ] Withheld student sees no marks (check network tab too); publish → visible.
- [ ] Student role cannot reach staff pages or staff APIs.
- [ ] Fresh clone → follow README → app runs with seed data.

## Acceptance Criteria
- [ ] `npm test` passes.
- [ ] Manual checklist completed and ticked before submission.
