# Task 05 — Fees & Payments

**Status:** ⬜ Not started
**Depends on:** 04
**Estimate:** 1 day
**Requirement ref:** requirement.md §2

## Goal
Registry can see exactly what each student owes, record payments, and spot overdue balances immediately.

## Requirements
- Assign a fee amount to each student based on their programme.
- Record payments: amount, date, reference number.
- Show outstanding balance in real time.
- Flag students with an overdue balance on the dashboard.

## Details

### Fee assignment
- On enrolment, a `Fee` is created: `amount = programme.feeAmount`, `dueDate` = configurable (default: 30 days after enrolment or start of term), `academicYear` = student's year.
- Staff can add extra fee lines (e.g. resit fee) or adjust with a note — optional stretch.

### Balance logic (`src/lib/domain/fees.ts`)
```ts
balance = sum(fees.amount) - sum(payments.amount)
isOverdue = balance > 0 && any(fee.dueDate < today with unpaid portion)
```
- Pure functions, unit tested (Task 11).
- Computed in the query (Prisma aggregate / SQL) for list views to avoid N+1.

### API routes
| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/students/[id]/fees` | Fees, payments, balance, overdue flag |
| `POST` | `/api/students/[id]/payments` | Record a payment |
| `GET` | `/api/fees/overdue` | Overdue list for dashboard |

### UI
- Student profile → **Fees tab**: total fees, total paid, **outstanding balance** (large, red if overdue), due date, payment history table, "Record payment" form.
- After recording a payment the balance updates immediately (revalidate / optimistic refresh).
- Student view `/me/fees`: read-only fees, payments, balance, due date.

## Edge Cases
- Amount must be > 0, max 2 decimal places.
- Payment reference must be **unique** → `409` "Reference already recorded" (prevents double-entry).
- Payment date cannot be in the future.
- **Overpayment** → allowed, shown as "Credit £X" rather than a negative balance; warn before saving.
- Balance exactly 0 → "Paid in full" badge.
- Withdrawn student with balance → still overdue (debt still owed).
- Deferred student → fee still shown; overdue rule applies (documented decision).
- Currency formatting consistent (`£1,250.00`).

## Acceptance Criteria
- [ ] New student automatically has a fee matching their programme.
- [ ] Recording a payment reduces the balance immediately.
- [ ] Duplicate reference is rejected.
- [ ] Overdue students appear on dashboard and in the students list with a flag.
- [ ] Money uses `Decimal` end-to-end (no float rounding issues).
