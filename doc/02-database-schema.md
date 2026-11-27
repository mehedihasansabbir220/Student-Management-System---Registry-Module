# Task 02 — Database Schema (Prisma)

**Status:** ✅ Done
**Depends on:** 01
**Estimate:** 0.5 day
**Assessment weight:** Stakeholder understanding (30%) + Technical quality (25%)

## Goal
A clean, normalised schema that mirrors how a Registry team works: programmes own fees, students enrol on programmes, staff set assessments within modules, and results are released deliberately.

## Entities

| Model | Key fields | Notes |
|---|---|---|
| **Programme** | `id`, `code` (unique), `name`, `feeAmount Decimal(10,2)`, `durationYears` | Fee is defined at programme level |
| **Module** | `id`, `code` (unique), `title`, `programmeId` | Assessments belong to a module |
| **Student** | `id`, `studentNumber` (unique, `SMS-YYYY-NNNN`), `fullName`, `email` (unique), `dateOfBirth`, `programmeId`, `academicYear` (e.g. `2025/26`), `status` enum, `createdAt`, `updatedAt` | |
| **StudentIdSequence** | `year` (PK), `lastValue` | Used to generate IDs safely in a transaction |
| **Fee** | `id`, `studentId`, `description`, `amount Decimal(10,2)`, `dueDate`, `academicYear`, `createdAt` | Snapshot of programme fee at the time of assignment |
| **Payment** | `id`, `studentId`, `feeId?`, `amount Decimal(10,2)`, `paidOn` (date), `reference` (unique), `method?`, `createdAt` | |
| **Assessment** | `id`, `title`, `moduleId`, `deadline` (timestamptz), `createdAt` | |
| **Submission** | `id`, `assessmentId`, `studentId`, `fileName`, `filePath`, `mimeType`, `sizeBytes`, `submittedAt`, `isLate`, `version` | `@@unique([assessmentId, studentId])` |
| **Grade** | `id`, `assessmentId`, `studentId`, `mark Decimal(5,2)`, `enteredAt`, `updatedAt` | `@@unique([assessmentId, studentId])` |
| **ResultRelease** | `studentId` (unique), `status` enum (`WITHHELD`, `PUBLISHED`), `reason?`, `publishedAt?`, `updatedAt` | Per-student publish / withhold control |

### Enums
```prisma
enum EnrolmentStatus { ENROLLED DEFERRED WITHDRAWN COMPLETED }
enum ReleaseStatus   { WITHHELD PUBLISHED }
```

## Design Decisions
- **Money as `Decimal`**, never `Float`, to avoid rounding errors.
- **Balance is not stored** — computed from `Fee` and `Payment` so it is always correct.
- **Fee snapshot** — `Fee.amount` is copied from `Programme.feeAmount` on enrolment; changing the programme price later does not change existing debts.
- **`isLate` stored on Submission** — computed at upload time (`submittedAt > deadline`) and persisted, so it remains accurate even if the deadline is later extended.
- **Classification not stored** — derived from `mark` (single source of truth).
- **Default release status = `WITHHELD`** — results are never visible by accident.
- **Indexes** on `Student(fullName)`, `Student(status)`, `Student(programmeId)` for search/filter.
- **Delete behaviour** — students are never hard-deleted (use status `WITHDRAWN`); `onDelete: Restrict` on financial records.

## Acceptance Criteria
- [ ] `prisma/schema.prisma` contains all models, enums, relations, unique constraints and indexes above.
- [ ] Initial migration created and applied (`prisma/migrations/...` committed).
- [ ] `npx prisma studio` shows all tables.
- [ ] ER summary (or Mermaid diagram) added to README.
