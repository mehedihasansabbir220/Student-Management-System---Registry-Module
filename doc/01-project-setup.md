# Task 01 — Project Setup

**Status:** ✅ Done
**Depends on:** —
**Estimate:** 0.5 day

## Goal
A running Next.js (App Router) + TypeScript project connected to PostgreSQL through Prisma, committed to a GitHub repository.

## Scope
- Initialise Next.js with App Router, TypeScript, ESLint, Tailwind CSS.
- Install and initialise Prisma; connect to a local PostgreSQL database.
- Set up project folder structure.
- Create `.env.example` and `.gitignore`.
- Initialise git and push to GitHub.

## Details

### Commands (reference)
```bash
npx create-next-app@latest . --ts --app --eslint --tailwind --src-dir
npm i @prisma/client zod
npm i -D prisma tsx
npx prisma init
```

### Suggested folder structure
```
src/
  app/
    (staff)/            # staff pages: dashboard, students, fees, assessments, marksheet
    (student)/          # student pages: my profile, my fees, my submissions, my results
    api/                # route handlers
  components/           # shared UI (tables, badges, forms)
  lib/
    prisma.ts           # Prisma client singleton
    validation/         # zod schemas
    domain/             # pure business logic (balance, classification, lateness)
prisma/
  schema.prisma
  seed.ts
uploads/                # local file storage for submissions (git-ignored)
doc/                    # task documents (this folder)
```

### Environment variables (`.env.example`)
| Variable | Example | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/sms?schema=public` | Prisma connection |
| `UPLOAD_DIR` | `./uploads` | Where submission files are stored |
| `MAX_UPLOAD_MB` | `10` | Upload size limit |

Optional: a `docker-compose.yml` with a Postgres service so reviewers can run `docker compose up -d`.

## Acceptance Criteria
- [ ] `npm run dev` starts the app at `http://localhost:3000`.
- [ ] `npx prisma migrate dev` succeeds against local Postgres.
- [ ] `.env` is git-ignored; `.env.example` is committed.
- [ ] Repository exists on GitHub with an initial commit.
- [ ] `src/lib/prisma.ts` exports a singleton client (no hot-reload connection leaks).
