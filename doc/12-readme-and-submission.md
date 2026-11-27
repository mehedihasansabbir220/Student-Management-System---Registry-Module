# Task 12 — README, AI Usage & Submission

**Status:** ✅ Done
**Depends on:** all tasks
**Estimate:** 0.5 day
**Assessment weight:** AI usage (15%) + supports all other dimensions

## Goal
A README that lets a reviewer run the project in minutes and clearly shows our product thinking and AI usage.

## README Sections
1. **Overview** — what the app does, the four workflows, screenshots/GIF.
2. **Tech stack** — Next.js (App Router), PostgreSQL, Prisma, zod, Tailwind, Vitest.
3. **Getting started**
   ```bash
   git clone <repo>
   cd <repo>
   cp .env.example .env
   docker compose up -d        # or use a local Postgres
   npm install
   npx prisma migrate dev
   npx prisma db seed
   npm run dev
   ```
4. **Environment variables** — table of `DATABASE_URL`, `UPLOAD_DIR`, `MAX_UPLOAD_MB` with descriptions.
5. **Using the app** — role toggle, demo students and the edge case each demonstrates.
6. **Data model** — Mermaid ER diagram + short explanation.
7. **Product decisions & edge cases** — copy/expand the decisions list from [`doc/README.md`](./README.md).
8. **API reference** — table of routes.
9. **How I used AI** (required) — be specific and honest:
   - Tools used (e.g. Claude Code) and for which tasks (requirement breakdown into `doc/`, schema drafting, boilerplate, tests, seed data).
   - Examples of prompts and how output was reviewed.
   - Where AI was **wrong or corrected** (e.g. float for money, missing role checks) and what was changed.
   - What was written/decided manually and why.
10. **Known limitations & next steps** — real auth, cloud file storage, audit log, multiple fee instalments, email notifications.

## Submission Checklist
- [ ] All code committed to GitHub (no zip files); meaningful commit history.
- [ ] `.env` not committed; `.env.example` present.
- [ ] Seed script works on a fresh database.
- [ ] Staff and Student views both work.
- [ ] README complete, including AI usage section.
- [ ] Repository link sent before the 7-working-day deadline.
