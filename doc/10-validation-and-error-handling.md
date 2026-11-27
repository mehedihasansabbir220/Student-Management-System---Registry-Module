# Task 10 — Validation & Error Handling (cross-cutting)

**Status:** ✅ Done
**Depends on:** applies to all feature tasks
**Assessment weight:** Technical quality (25%)

## Goal
Every API route validates input, returns consistent errors, and the UI shows them clearly — no raw stack traces, no silent failures.

## Details

### Validation
- **zod** schemas in `src/lib/validation/` shared by forms (client) and route handlers (server).
- Server is the source of truth; client validation is only for UX.

### Consistent error response
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Email is already in use", "fields": { "email": "Already in use" } } }
```

| Status | When |
|---|---|
| `400` | Invalid input (zod failure) |
| `403` | Wrong role / accessing another student's data |
| `404` | Record not found |
| `409` | Unique conflict (email, payment reference, duplicate submission race) |
| `413` | File too large |
| `415` | Unsupported file type |
| `422` | Business-rule violation (e.g. resubmission after deadline, withdrawn student submitting) |
| `500` | Unexpected — logged server-side, generic message to client |

### Helpers
- `withErrorHandling(handler)` wrapper for route handlers: maps `ZodError`, Prisma `P2002` (unique) / `P2025` (not found), and custom `DomainError` to the responses above.
- UI: inline field errors on forms, toast for action errors, `error.tsx` and `not-found.tsx` boundaries in the App Router.
- Loading states (`loading.tsx`) and disabled submit buttons while pending.

## Acceptance Criteria
- [ ] All routes use the shared wrapper and return the standard error shape.
- [ ] Prisma unique errors become friendly `409` messages.
- [ ] No unhandled promise rejections in the console during normal flows.
