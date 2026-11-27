# Task 07 — Marksheet & Results

**Status:** ✅ Done
**Depends on:** 06
**Estimate:** 1 day
**Requirement ref:** requirement.md §4

## Goal
Staff enter and manage grades; each student's results are released deliberately, and students see nothing until published.

## Requirements
- Staff enter a numeric grade (0–100) per student per assessment.
- Classification: **Pass ≥ 40, Merit ≥ 60, Distinction ≥ 70** (below 40 = **Fail**).
- Staff publish or withhold results per student.
- Students see their marksheet only after publication.

## Details

### Classification (`src/lib/domain/grades.ts`)
```ts
mark >= 70 → 'Distinction'
mark >= 60 → 'Merit'
mark >= 40 → 'Pass'
else       → 'Fail'
```
Boundaries are inclusive (exactly 40 = Pass, 60 = Merit, 70 = Distinction). Unit tested.

### Release control
- `ResultRelease` per student: `WITHHELD` (default) or `PUBLISHED`, optional `reason`, `publishedAt`.
- Withhold reasons (suggested list): Outstanding fees · Academic misconduct review · Pending moderation · Other.
- Suggest (not force) withholding when the student has an **overdue balance**.

### API routes
| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/marksheet?assessmentId=` | Staff grid of students × marks |
| `PUT` | `/api/grades` | Upsert a grade `{assessmentId, studentId, mark}` |
| `POST` | `/api/students/[id]/results/publish` | Publish |
| `POST` | `/api/students/[id]/results/withhold` | Withhold `{reason}` |
| `GET` | `/api/me/results` | Student: returns grades **only if published**, else `{status:'WITHHELD'}` |

### UI
- Staff `/staff/marksheet`: choose assessment → grid of students with mark input, live classification badge, submission state (late / missing).
- Per-student result panel (student profile → Results tab): all marks, overall average, release status, Publish / Withhold buttons.
- Student `/me/results`:
  - Published → marksheet table (assessment, module, mark, classification).
  - Withheld → "Your results are not yet available" (reason shown only if staff choose to share it).

## Edge Cases
- Mark outside 0–100, non-numeric, or more than 2 decimals → rejected.
- Grading a student with **no submission** → allowed (e.g. 0 for non-submission) but UI warns.
- Grade changed **after** publish → stays published but shows "updated" timestamp; documented.
- Withholding after publish → student immediately loses visibility.
- Withheld data must be filtered on the **server** — never sent to the browser and hidden with CSS.

## Acceptance Criteria
- [ ] Staff can enter/edit grades; classification shown correctly at boundaries.
- [ ] Results default to withheld for every student.
- [ ] Publishing makes results visible on the student view; withholding hides them.
- [ ] Student API never returns unpublished marks.
