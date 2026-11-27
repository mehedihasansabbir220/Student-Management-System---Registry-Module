# Task 06 — Assessment Submission

**Status:** ⬜ Not started
**Depends on:** 04
**Estimate:** 1 day
**Requirement ref:** requirement.md §3

## Goal
Staff create assessments; students upload one PDF/DOCX per assessment, can resubmit before the deadline, and late work is accepted but clearly flagged.

## Requirements
- Staff create assessment: title, module, submission deadline.
- Students upload PDF or DOCX against an open assessment.
- One submission per student per assessment; resubmission allowed before the deadline.
- Late submissions accepted but visually flagged.

## Details

### Submission rules (`src/lib/domain/submissions.ts`)
| Situation | Result |
|---|---|
| Before deadline, no submission | Create, `isLate = false` |
| Before deadline, existing submission | Replace file, `version++`, `isLate = false` |
| After deadline, no submission | Create, `isLate = true` (**Late** badge) |
| After deadline, existing on-time submission | **Rejected** — on-time work cannot be overwritten after the deadline |
| After deadline, existing late submission | Rejected (one late attempt only) |
| Student status `WITHDRAWN` / `DEFERRED` | Rejected with clear message |
| Assessment's module not in student's programme | Not shown / rejected |

- Deadline comparison done on the **server** using server time, stored in UTC; displayed in local time with timezone.

### File handling
- Accept only `.pdf` and `.docx`; check extension **and** MIME type (and ideally magic bytes: `%PDF`, `PK`).
- Max size from `MAX_UPLOAD_MB` (default 10 MB).
- Stored in `UPLOAD_DIR/{assessmentId}/{studentId}/{uuid}.{ext}`; original name kept in DB.
- Old file deleted (or kept as history) on resubmission.
- Download via `GET /api/submissions/[id]/file` with role check (staff, or owning student).

### API routes
| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/assessments` | List (staff: all; student: their programme's) |
| `POST` | `/api/assessments` | Staff create |
| `PATCH` | `/api/assessments/[id]` | Edit / extend deadline |
| `POST` | `/api/assessments/[id]/submissions` | Student upload (multipart) |
| `GET` | `/api/assessments/[id]/submissions` | Staff: all submissions incl. missing students |
| `GET` | `/api/submissions/[id]/file` | Download |

### UI
- Staff `/staff/assessments`: list with deadline, counts (submitted / late / missing).
- Staff assessment detail: every student on the programme with state **On time · Late · Not submitted**.
- Student `/me/assessments`: each assessment with status **Open · Closing soon (<48h) · Closed**, countdown, current submission, upload/resubmit button.
- **Late** badge in amber/red wherever a submission is shown.

## Edge Cases
- Deadline in the past when creating → warning (allowed for back-dated entries).
- Deadline extended after late submissions → existing `isLate` stays as recorded.
- Empty file / wrong type / renamed `.exe` to `.pdf` → rejected.
- Double-click upload → idempotent via unique constraint (upsert).

## Acceptance Criteria
- [ ] Staff can create an assessment for a module.
- [ ] Student can upload PDF/DOCX; other types rejected with a clear error.
- [ ] Resubmission before deadline replaces the previous file.
- [ ] Submission after deadline is saved and shows a **Late** flag to staff and student.
- [ ] Database guarantees one submission per student per assessment.
