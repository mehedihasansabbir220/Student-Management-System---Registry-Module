# Task 08 — Registry Dashboard

**Status:** ✅ Done
**Depends on:** 05, 06, 07
**Estimate:** 0.5 day

## Goal
The first screen a Registry Administrator sees each morning: what needs attention today.

## Widgets
| Widget | Content | Action |
|---|---|---|
| **Headline stats** | Students by status (Enrolled / Deferred / Withdrawn / Completed) | Click → filtered student list |
| **Overdue balances** ⚠️ | Students with overdue balance: ID, name, amount, days overdue — sorted by amount/days | Click → student Fees tab |
| **Upcoming deadlines** | Assessments due in the next 7 days with submitted/missing counts | Click → assessment detail |
| **Late submissions** | Recent late submissions | Click → submission |
| **Results awaiting release** | Students with grades entered but results withheld | Click → Results tab |
| **Finance summary** | Total billed, total collected, total outstanding | — |

## Details
- Server Component, data loaded with efficient aggregate queries (no N+1).
- Overdue count also shown as a badge in the navigation.
- Empty states for each widget ("No overdue balances 🎉").

## Acceptance Criteria
- [ ] Overdue students are clearly flagged on the dashboard (required).
- [ ] All numbers match the underlying data (verify with seed data).
- [ ] Every widget links to the relevant detail page.
