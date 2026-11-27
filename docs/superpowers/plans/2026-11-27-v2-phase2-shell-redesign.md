# v2 Phase 2 — shadcn App Shell & Page Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v1 hand-rolled Tailwind UI with a shadcn/ui design system and a real app shell, and rebuild every existing page (login, activation, staff and student areas) on it with no loss of v1 behaviour.

**Architecture:** shadcn primitives live in `src/components/ui/*` (generated, lightly themed). App-level composites (`PageHeader`, `EmptyState`, `DataTable`, status badges, form kit) live in `src/components/*`. Pure logic that drives the UI (navigation model, breadcrumbs, table URL state, API-error → form mapping, client file checks) lives in `src/lib/*` and is unit-tested. The shell is rendered by `src/app/staff/layout.tsx` and `src/app/me/layout.tsx`; the root layout only provides fonts, theme and toasts. Pages stay Server Components that call services directly; only interactive pieces are client components calling the existing API through `apiFetch`.

**Tech Stack:** Next.js 15.5 App Router, React 19, Tailwind 4, shadcn/ui (CLI `shadcn@latest`, style "new-york", base colour neutral), `lucide-react`, `sonner`, `next-themes`, `@tanstack/react-table`, `react-hook-form` + `@hookform/resolvers`, Playwright (`@playwright/test`) for browser smoke.

**Spec:** `docs/superpowers/specs/2026-11-27-v2-product-design.md` (§5.3 UI system, §5.4 staff pages (structure only; charts are phase 3), §5.5 student portal, §5.7 demo buttons, §7 priority 2). Phase 1 plan: `docs/superpowers/plans/2026-11-27-v2-phase1-auth.md`.

## Global Constraints

- Phase 1 constraints still hold (tests first in `tests/`, `npm test` + `npx tsc --noEmit` + `npx eslint .` before each commit, never touch `.next` / port 3000; verification builds use `NEXT_DIST_DIR=.next-verify` on port 3100).
- **Commits carry no AI attribution** (no `Co-Authored-By` / "Generated with" lines). This is the user's standing instruction.
- **Not in this phase** (don't render placeholders for them either: anti-goal "nothing half-finished"): ⌘K palette and charts (phase 3), notifications bell, receipts, CSV export, bulk release (phase 4), finance ledger, audit and users pages (phase 6).
- Visual direction: calm, dense internal tool. Neutral base, one accent **deep indigo** (`--primary: oklch(0.398 0.195 277.366)` light / `oklch(0.585 0.233 277.117)` dark). Status colours only carry meaning: red = overdue/late/fail, amber = attention, green = done. Geist font (already loaded), `tabular-nums` on every money and mark cell. No gradients or illustrations.
- Dark mode: `next-themes`, `attribute="class"`, `defaultTheme="system"`, `enableSystem`, toggle in the top bar (Light / Dark / System).
- Sidebar groups, in order: **Overview · Students · Finance · Academic · Administration**. Each item is shown only if the role holds its permission. Empty groups are hidden.
- Every form shows inline field errors from the API error body `{ error: { code, message, fields?, requestId } }`, has a pending state, and on failure shows a toast whose description ends with `Reference: <requestId>`.
- Mobile (< 768 px): the sidebar becomes a Sheet opened from a menu button in the top bar. No horizontal page scroll; wide tables scroll inside their own container.
- Every v1 guarantee stays: withheld marks never reach the client, money is integer pence formatted by `formatGBP`, the activation link is shown exactly once after enrolment, etc. Rebuilding a page must keep all of its data and actions; the old page is the checklist.

## Review Focus

1. **Hand-edited table URL** (`?page=0&sort=bogus&pageSize=9999`): the page renders with defaults clamped (page ≥ 1, pageSize ≤ 100, unknown sort → `name`) and the "some filters were invalid" notice. It must not 500. → Task 3 tests (`parseTableState`, `studentListQuerySchema`).
2. **Page past the end** (`?page=40` when there are 3 pages, e.g. after filtering): shows the empty state with a "Go to first page" link, not a blank table. → Task 3 test (`pageCount` stays ≥ 1, `page > pageCount` flagged by `parseTableState`).
3. **API error with no `fields` / network failure / non-JSON 502**: the form keeps the user's input, shows a toast with a generic message, and the button leaves its pending state. → Task 2 tests (`describeError`).
4. **Role sees a link it can't use**: FINANCE must not see Assessments/Results, ACADEMIC must not see finance columns or payment actions. → Task 1 tests (`navFor`), Task 4 assertion that finance UI renders only with `finance.read`.
5. **Theme flash and hydration warnings**: first paint in dark mode must not flash light, and there should be no hydration error in the console. → Task 8 Playwright smoke asserts zero console errors on every page per role.

---

### Task 1: Design system foundation & app shell

**Files:**
- Create: `components.json`, `src/lib/utils.ts` (`cn`), `src/components/ui/*` (via CLI), `src/lib/nav.ts`, `src/lib/breadcrumbs.ts`, `src/components/shell/app-shell.tsx`, `src/components/shell/app-sidebar.tsx`, `src/components/shell/top-bar.tsx`, `src/components/shell/theme-toggle.tsx`, `src/components/shell/user-menu.tsx` (replaces `src/components/user-menu.tsx`), `src/components/providers.tsx`, `src/server/shell.ts`
- Modify: `src/app/globals.css` (shadcn tokens + indigo accent; keep the v1 `.btn/.input/table.data` rules until Task 8), `src/app/layout.tsx` (providers only, no header), `src/app/staff/layout.tsx`, `src/app/me/layout.tsx`, `package.json`
- Delete: `src/components/nav-link.tsx`, `src/components/user-menu.tsx`
- Test: `tests/unit/lib/nav.test.ts`, `tests/unit/lib/breadcrumbs.test.ts`

**Interfaces:**
- Produces:
  - `type NavItem = { href: string; label: string; icon: LucideIconName; exact?: boolean }` where `LucideIconName` is a string union of the icon names used (the shell maps names to components, so `nav.ts` stays free of React).
  - `type NavGroup = { label: "Overview" | "Students" | "Finance" | "Academic" | "Administration" | "My study"; items: NavItem[] }`
  - `navFor(role: Role): NavGroup[]` in `src/lib/nav.ts`
  - `isActive(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean`
  - `type Crumb = { label: string; href?: string }`; `breadcrumbsFor(pathname: string, titles?: Record<string, string>): Crumb[]` in `src/lib/breadcrumbs.ts`. The last crumb has no `href`. `titles` maps a dynamic segment value (e.g. a student id) to a display label.
  - `<AppShell user={ShellUser} area="staff" | "student">{children}</AppShell>`; `type ShellUser = { name: string; email: string; role: Role; isDemo: boolean }`
  - `loadShellUser(): Promise<{ user: SessionUser | null; dbDown: boolean }>` in `src/server/shell.ts` (moved from the root layout's `loadUser`, still calls `unstable_rethrow`).
  - `cn(...inputs: ClassValue[]): string` in `src/lib/utils.ts`.

Navigation model (exact):

| Group | Item (href · label · permission) |
|---|---|
| Overview | `/staff` · Dashboard · `dashboard.read` (exact) |
| Students | `/staff/students` · Students · `students.read` |
| Academic | `/staff/assessments` · Assessments · `submissions.read`; `/staff/results` · Results release · `results.release` |
| Student role, group "My study" | `/me` · Home (exact); `/me/assessments` · Coursework; `/me/fees` · Fees; `/me/results` · Results |

Finance and Administration have no items yet, so they're hidden by the empty-group rule. Phases 4 and 6 add their items here. The account page (Task 2) is reached from the user menu, not the sidebar.

Breadcrumb labels: `staff` → "Registry", `me` → "My study", `students` → "Students", `assessments` (staff) → "Assessments", `assessments` (me) → "Coursework", `results` (staff) → "Results release", `results` (me) → "Results", `fees` → "Fees", `account` → "Account", `new` → "New". Unknown dynamic segments fall back to `titles[segment] ?? "Details"`.

- [ ] **Step 1: Write failing tests**
  - `navFor("REGISTRY_ADMIN")` returns groups `["Overview","Students","Academic"]` with all four staff hrefs.
  - `navFor("FINANCE")` returns hrefs `["/staff","/staff/students"]` only. `navFor("ACADEMIC")` returns `["/staff","/staff/students","/staff/assessments"]` (no `/staff/results`).
  - `navFor("STUDENT")` returns one group "My study" with the four `/me` hrefs.
  - No group in any role's output has `items.length === 0`.
  - `isActive("/staff", {href:"/staff", exact:true})` is true; `isActive("/staff/students", {href:"/staff", exact:true})` is false; `isActive("/staff/students/abc", {href:"/staff/students"})` is true; `isActive("/staff/studentsx", {href:"/staff/students"})` is false.
  - `breadcrumbsFor("/staff/students/abc", { abc: "Amelia Clarke" })` returns `[{label:"Registry",href:"/staff"},{label:"Students",href:"/staff/students"},{label:"Amelia Clarke"}]`.
  - `breadcrumbsFor("/me/assessments")` returns `[{label:"My study",href:"/me"},{label:"Coursework"}]`. `breadcrumbsFor("/staff")` returns `[{label:"Registry"}]`. A trailing slash is ignored.
- [ ] **Step 2: Run** `npx vitest run tests/unit/lib/nav.test.ts tests/unit/lib/breadcrumbs.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement.**
  - `npx shadcn@latest init` (new-york, neutral, CSS variables, `src/components/ui`, alias `@/components/ui`, utils `@/lib/utils`).
  - `npx shadcn@latest add button card badge input label select textarea dialog sheet dropdown-menu avatar separator tooltip table tabs skeleton breadcrumb sidebar sonner alert popover command checkbox`.
  - `npm i next-themes`.
  - Set the indigo `--primary` / `--ring` / `--sidebar-primary` tokens (Global Constraints).
  - Shell: shadcn `SidebarProvider` + collapsible `Sidebar` (icon-collapse on desktop, Sheet on mobile, cookie-persisted state per shadcn default), `SidebarInset` holding the top bar (sidebar trigger, `Breadcrumb` from `breadcrumbsFor`, then on the right `ThemeToggle` and `UserMenu`), then `<main className="mx-auto w-full max-w-7xl p-4 md:p-6">`.
  - `UserMenu`: initials `Avatar`, name, email, role label, a "Demo account" badge when `isDemo`, an "Account" item (`/staff/account` or `/me/account`), and "Sign out" (same logic as the old menu).
  - Pages pass `titles` for dynamic crumbs through a `<BreadcrumbTitle id label />` client component that writes into a React context the top bar reads (so a server page can name its own crumb).
  - Layouts: call `loadShellUser()`. If `dbDown`, render a full-page `Alert` ("The database is currently unavailable…") with no redirect. Otherwise keep the current redirect rules and wrap children in `AppShell`.
  - Root layout: `<Providers>` = `ThemeProvider` + `TooltipProvider` + `<Toaster richColors closeButton />`.
- [ ] **Step 4: Run** the tests, then `npm test`, `npx tsc --noEmit`, `npx eslint .`. Expected: PASS and clean. Build check: `NEXT_DIST_DIR=.next-verify npx next build` succeeds.
- [ ] **Step 5: Commit** `feat(ui): shadcn design system, theme and role-aware app shell`

---

### Task 2: Form & feedback kit; login, activation and account pages

**Files:**
- Create: `src/lib/form-errors.ts`, `src/components/form/use-api-form.ts`, `src/components/form/form-fields.tsx`, `src/components/feedback.ts`, `src/components/account/change-password-form.tsx`, `src/components/account/sessions-card.tsx`, `src/components/account/account-page.tsx`, `src/app/staff/account/page.tsx`, `src/app/me/account/page.tsx`, `src/app/(auth)/layout.tsx`
- Modify: move `src/app/login/*` and `src/app/activate/*` under `src/app/(auth)/` (URLs unchanged), rebuild `login-form.tsx` and `activate-form.tsx`; `src/lib/breadcrumbs.ts` (no change needed if Task 1's `account` label is in place)
- Test: `tests/unit/lib/form-errors.test.ts`

**Interfaces:**
- Consumes: `ApiClientError` (`message`, `code`, `fields: Record<string,string>`, `requestId?`, `status`) from `src/lib/api-client.ts`; `changePasswordSchema`, `activateSchema`, `loginSchema` from `src/lib/validation.ts`; existing endpoints `POST /api/auth/change-password`, `GET/DELETE /api/auth/sessions`.
- Produces:
  - `describeError(err: unknown): { title: string; description?: string; fields: Record<string, string> }` in `src/lib/form-errors.ts`.
  - `useApiForm<S extends z.ZodType>(schema: S, submit: (values: z.infer<S>) => Promise<unknown>, opts?: { defaultValues?: Partial<z.infer<S>>; onSuccess?: (r: unknown) => void; successToast?: string; refresh?: boolean })`. It returns the react-hook-form `form` plus `onSubmit`. On `ApiClientError` it calls `form.setError(name, { message })` for each field, else shows a toast via `notifyError`. `refresh` defaults to true (`router.refresh()`).
  - `notifyError(err: unknown): void` and `notifySuccess(message: string): void` in `src/components/feedback.ts` (wrap `sonner`'s `toast`).
  - `<TextField form name label type? hint? autoComplete? />`, `<SelectField form name label options />`, `<SubmitButton pending>label</SubmitButton>` in `form-fields.tsx`. Each sets `aria-invalid` and `aria-describedby` on error.
  - `<AccountPage user={ShellUser} />` server component used by both account routes.

- [ ] **Step 1: Write failing tests** for `describeError`:
  - `ApiClientError` with `fields: { email: "Already enrolled" }`, `requestId: "req_1"` → `{ title: <message>, description: "Reference: req_1", fields: { email: "Already enrolled" } }`.
  - `ApiClientError` with no requestId → `description` is undefined.
  - `new TypeError("Failed to fetch")` → `{ title: "Can't reach the server. Check your connection and try again.", fields: {} }`.
  - Any other value (`"boom"`, `undefined`, `new Error("x")`) → `{ title: "Something went wrong. Please try again.", fields: {} }`.
  - `ApiClientError` with status 429 → title is the server message (e.g. the lockout text) unchanged.
- [ ] **Step 2: Run** `npx vitest run tests/unit/lib/form-errors.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `npm i react-hook-form @hookform/resolvers`.
  - `(auth)/layout.tsx`: centred card layout with the brand mark and theme toggle. No sidebar.
  - **Login:** email/password form via `useApiForm(loginSchema, …)`. When `DEMO_MODE`, show a "Try a demo account" grid of four one-click role cards (icon, role label, description). Clicking one signs in straight away with a per-card pending spinner, as the existing demo buttons do. Also show the "Demo data resets nightly" line, and keep the `next` param via `safeNextPath`.
  - **Activate:** same layout; it shows the password policy hint (≥ 10 chars, not your email), and the expired/used-token error renders as an `Alert` with "Ask the Registry office for a new link".
  - **Account:** profile card (name, email, role), the change-password card, and the sessions card (lists sessions, marks "This device", and has a "Sign out other sessions" button). For `isDemo` users, the password and sign-out controls are disabled with the explanation "Demo accounts are shared, so this is turned off." The server already enforces this, and the UI shows the server error if it is bypassed.
- [ ] **Step 4: Run** tests + `npm test`, `tsc`, `eslint`. Expected: clean.
- [ ] **Step 5: Commit** `feat(ui): form kit with API error mapping; rebuilt login, activation and account pages`

---

### Task 3: URL-synced data table & students list

**Files:**
- Create: `src/lib/table-state.ts`, `src/components/data-table/data-table.tsx`, `src/components/data-table/data-table-toolbar.tsx`, `src/components/data-table/faceted-filter.tsx`, `src/components/data-table/pagination.tsx`, `src/components/data-table/column-header.tsx`, `src/components/common.tsx` (`PageHeader`, `EmptyState`, `DescriptionList`, `StatCard`, `Notice`, reimplemented on shadcn), `src/app/staff/students/students-table.tsx`, `src/app/staff/students/enrol-student-sheet.tsx`
- Modify: `src/lib/validation.ts` (`studentListQuerySchema` gains `sort`), `src/server/services/students.ts` (`listStudents` honours `sort`), `src/components/badges.tsx` (rebuilt on shadcn `Badge` with tone variants, same exports), `src/app/staff/students/page.tsx`, `src/app/staff/students/new/page.tsx` (→ `redirect("/staff/students?enrol=1")`), move `student-form.tsx` content into the sheet
- Test: `tests/unit/lib/table-state.test.ts`, `tests/unit/lib/validation.test.ts` (extend), `tests/integration/students.test.ts` (extend)

**Interfaces:**
- Produces:
  - `STUDENT_SORTS = ["name","-name","studentNumber","-studentNumber","year","-year","enrolled","-enrolled"] as const` in `validation.ts`. `sort` defaults to `"name"`, and an unknown value is a validation error (the page then falls back to defaults with the notice, as v1 does). Mapping: name → `fullName`, studentNumber → `studentNumber`, year → `academicYear`, enrolled → `createdAt`. A leading `-` means desc. `studentNumber` asc is always the tiebreaker.
  - `type TableState = { page: number; pageSize: number; sort?: string; filters: Record<string, string> }`
  - `parseTableState(params: URLSearchParams, opts: { filterKeys: readonly string[]; defaultPageSize?: number }): TableState` (tolerant: clamps instead of throwing).
  - `tableStateHref(pathname: string, state: TableState, patch: Partial<Omit<TableState,"filters">> & { filters?: Record<string, string | undefined> }): string`. Changing filters or sort resets `page` to 1. Default values (`page=1`, default pageSize, empty filters) are omitted from the URL.
  - `<DataTable columns data total page pageCount pageSize emptyState toolbar? />`, a client component using `@tanstack/react-table` with `manualPagination` and `manualSorting`. It navigates with `router.push(tableStateHref(...), { scroll: false })` and shows a `Skeleton` overlay while `useTransition` is pending. Column visibility is a dropdown in the toolbar, persisted per table in `localStorage` (wrapped in try/catch).
  - `<FacetedFilter paramKey title options={{value,label}[]} />` (single-select; writes the URL param).

- [ ] **Step 1: Write failing tests**
  - `parseTableState(new URLSearchParams("page=0&pageSize=9999&status=ENROLLED&x=1"), { filterKeys: ["status"] })` → `{ page: 1, pageSize: 100, filters: { status: "ENROLLED" } }` (unknown keys are dropped).
  - `page=abc` → 1; `pageSize` missing → `defaultPageSize ?? 20`.
  - `tableStateHref("/staff/students", {page:3,pageSize:20,filters:{status:"ENROLLED"}}, { filters: { status: "DEFERRED" } })` → `"/staff/students?status=DEFERRED"` (page reset, defaults omitted).
  - `tableStateHref(..., { page: 2 })` keeps filters and sort. A filter patched to `undefined` removes the key.
  - `studentListQuerySchema.parse({ sort: "-year" }).sort === "-year"`; `{}` → `"name"`; `{ sort: "bogus" }` → throws.
  - Integration: with three seeded students, `listStudents({ ...defaults, sort: "-name" })` returns names in descending order; `sort: "studentNumber"` returns ascending student numbers; `page` beyond the end returns `items: []` with `pageCount ≥ 1`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/lib/table-state.test.ts tests/unit/lib/validation.test.ts tests/integration/students.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Students page:** `PageHeader` ("Students", count subtitle, "Enrol student" button when `students.write`). The toolbar has a debounced (300 ms) search box writing `q`, faceted filters for Programme and Status, and Column visibility. Columns: Student ID (mono), Name + email (link), Programme code (tooltip with the name), Year, Status badge, and, **only with `finance.read`**, Balance (right-aligned, tabular) and Fees (account badge). The sortable headers are name, studentNumber, year and enrolled.
  - Page beyond the end: empty state "No students on this page" with a "Go to first page" link.
  - The invalid-query notice is kept.
  - **Enrol sheet:** a right-side `Sheet` opened by the button or by `?enrol=1`, using `useApiForm(createStudentSchema, …)` with the same fields and fee hint as v1. After success, the sheet body is replaced by the success panel with the activation link (read-only input + Copy button + toast "Link copied"), shown only once, then "View student" / "Enrol another". Closing the sheet removes `enrol` from the URL.
- [ ] **Step 4: Run** tests + full checks. Expected: clean.
- [ ] **Step 5: Commit** `feat(ui): URL-synced data table, sortable students list and enrolment sheet`

---

### Task 4: Student record page (tabbed)

**Files:**
- Modify: `src/app/staff/students/[id]/page.tsx` and every client component in that folder (`add-fee-form.tsx`, `payment-form.tsx`, `void-payment.tsx`, `status-editor.tsx`, `portal-account.tsx`, `release-controls.tsx`), rebuilt on shadcn + `useApiForm`
- Create: `src/app/staff/students/[id]/student-header.tsx`
- Test: `tests/unit/lib/student-tabs.test.ts`, plus `src/lib/student-tabs.ts`

**Interfaces:**
- Consumes: `getStudent`, `getAccount`, `getStaffMarksheet` (unchanged), `can`, `DataTable` is **not** used here (small, unpaginated lists use the shadcn `Table` directly), `BreadcrumbTitle` (Task 1).
- Produces: `studentTabsFor(role: Role): ("overview" | "finance" | "results")[]` in `src/lib/student-tabs.ts`. "finance" requires `finance.read`, "results" requires `results.read` or `results.release`, "overview" is always present. `resolveTab(requested: string | undefined, role: Role): StudentTab` (where `type StudentTab = "overview" | "finance" | "results"`). The active tab is read from `?tab=`, and an unknown or forbidden tab falls back to "overview". Phase 3 appends "coursework" and "timeline".

- [ ] **Step 1: Write failing tests:** `studentTabsFor("FINANCE")` → `["overview","finance"]`; `ACADEMIC` → `["overview","results"]`; `REGISTRY_ADMIN` → all three; `resolveTab("results", "FINANCE")` → `"overview"`; `resolveTab(undefined, "REGISTRY_ADMIN")` → `"overview"`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/lib/student-tabs.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Header:** initials avatar, full name, student number (mono), status badge, programme, academic year, the account badge (with `finance.read`), and the portal-account badge ("Account active" / "Invitation pending").
  - **Tabs** (shadcn `Tabs`, URL-synced with `?tab=`):
    - Overview: details description list, the status editor (`students.write`), the portal account card with copy/regenerate activation link, and alerts (overdue, withheld).
    - Finance: an account summary of three stat cards (charged, paid, balance/credit/overdue days); a charges table and a payments table (voided rows struck through with the reason in a tooltip); "Record payment" and "Add charge" buttons opening `Dialog`s (`payments.write`, `fees.write`); a Void action per payment opening a confirm dialog with a required reason (`payments.void`).
    - Results: the marksheet table with classification badges, the average and overall classification, the release status badge, and the release controls (publish; withhold with a reason + "share reason with student" checkbox) when `results.release`.
  - Every mutation toasts success and refreshes the route.
- [ ] **Step 4: Run** tests + full checks + a verification build. Expected: clean.
- [ ] **Step 5: Commit** `feat(ui): tabbed student record with finance and results dialogs`

---

### Task 5: Assessments list & assessment detail

**Files:**
- Modify: `src/app/staff/assessments/page.tsx`, `create-assessment-form.tsx` (→ `Dialog`), `src/app/staff/assessments/[id]/page.tsx`, `grade-cell.tsx`, `deadline-editor.tsx`, `classification-preview.tsx`
- Test: `tests/unit/lib/roster.test.ts` + `src/lib/roster.ts`

**Interfaces:**
- Consumes: `listAssessmentsForStaff`, `getAssessmentRoster`, `listModules`, `classify` from `src/domain/grades.ts`.
- Produces: `rosterCounts(rows: { state: "ON_TIME" | "LATE" | "MISSING" }[]): { onTime: number; late: number; missing: number; total: number }` and `filterRoster<T extends { state: string }>(rows: T[], state?: "ON_TIME" | "LATE" | "MISSING"): T[]` in `src/lib/roster.ts`.

- [ ] **Step 1: Write failing tests:** counts over a mixed list; `filterRoster(rows, undefined)` returns all; `filterRoster(rows, "LATE")` returns only late rows; empty input → all zeros.
- [ ] **Step 2: Run** `npx vitest run tests/unit/lib/roster.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **List:** a table (module, title, deadline with relative time, window badge, submission counts on time/late/missing), plus a "Create assessment" `Dialog` (`assessments.write`) via `useApiForm(createAssessmentSchema)`.
  - **Detail:** header with the module, deadline and the inline deadline editor (`assessments.write`); three stat cards from `rosterCounts`, each clickable to filter (`?state=`); the roster table (student link, submitted at, Late badge, file download link, version, grade cell).
  - **Grade cell:** a number input 0–100 that saves on blur or Enter, shows the live classification badge while typing, a check icon on save, and the inline error from the API (`grades.write`; read-only otherwise).
- [ ] **Step 4: Run** tests + full checks. Expected: clean.
- [ ] **Step 5: Commit** `feat(ui): assessments list with create dialog and roster with inline grading`

---

### Task 6: Results release page & staff dashboard

**Files:**
- Modify: `src/app/staff/results/page.tsx`, `src/app/staff/page.tsx`
- Test: `tests/unit/lib/dashboard-sections.test.ts` + `src/lib/dashboard-sections.ts`

**Interfaces:**
- Consumes: `listReleaseOverview`, `getDashboard` (unchanged), `release-controls.tsx` from Task 4 (reused per row in a `Dialog`).
- Produces: `dashboardSectionsFor(role: Role): ("kpis" | "overdue" | "deadlines" | "late" | "awaitingRelease")[]` in `src/lib/dashboard-sections.ts`, ordered by role per spec §5.4. FINANCE: `["kpis","overdue"]`. ACADEMIC: `["kpis","deadlines","late"]`. REGISTRY_ADMIN: `["kpis","overdue","awaitingRelease","deadlines","late"]`. KPI cards are filtered with the same permissions (money KPIs need `finance.read`).

- [ ] **Step 1: Write failing tests** for the three role orders above, and that `STUDENT` returns `[]`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/lib/dashboard-sections.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Dashboard:** greeting with the date; a KPI `StatCard` row (enrolled, overdue £ + count, awaiting release, collected this month: whichever v1 `getDashboard` already returns, each linking to its list); then the action-queue cards in the role order, each a compact table with an empty state ("Nothing overdue 🎉" is not allowed; use plain "No overdue balances").
  - **Results release:** a table (student, programme, graded modules count, average, classification, release status, overdue-fee indicator) with per-row Publish / Withhold actions in dialogs. No row selection yet (bulk is phase 4).
- [ ] **Step 4: Run** tests + full checks. Expected: clean.
- [ ] **Step 5: Commit** `feat(ui): role-ordered dashboard and results release table`

---

### Task 7: Student portal

**Files:**
- Modify: `src/app/me/page.tsx`, `src/app/me/assessments/page.tsx`, `upload-form.tsx` (→ dropzone), `src/app/me/fees/page.tsx`, `src/app/me/results/page.tsx`, `src/app/me/loading.tsx`
- Create: `src/lib/upload.ts`, `src/lib/countdown.ts`
- Test: `tests/unit/lib/upload.test.ts`, `tests/unit/lib/countdown.test.ts`

**Interfaces:**
- Produces:
  - `checkFileBeforeUpload(file: { name: string; size: number }, maxMb: number): string | null`. It returns the exact v1 messages `"Only PDF or DOCX files can be submitted."` / `` `Files must be ${maxMb} MB or smaller.` `` and adds `"The file is empty."` for size 0.
  - `uploadWithProgress(url: string, body: FormData, onProgress: (fraction: number) => void): Promise<unknown>`, an XHR wrapper. On a non-2xx response it rejects with an `ApiClientError` built from the JSON error body (same shape `apiFetch` produces), and it sends the same headers `apiFetch` sends. On `401 TOKEN_EXPIRED` it calls `POST /api/auth/refresh` once and retries, as `apiFetch` does.
  - `countdown(deadline: Date, now: Date): { label: string; urgent: boolean }` gives "Due in 3 days" / "Due in 5 hours" / "Due in 12 minutes" / "Deadline passed". `urgent` means under 48 h and not passed.

- [ ] **Step 1: Write failing tests**
  - `checkFileBeforeUpload`: `.PDF` upper-case ok; `.doc` rejected; exactly `maxMb` MiB ok; one byte over rejected; size 0 → empty message.
  - `countdown`: 3 d → "Due in 3 days", urgent false; 47 h → "Due in 47 hours", urgent true; 1 h → "Due in 1 hour" (singular); past → "Deadline passed", urgent false.
  - `uploadWithProgress` with a fake `XMLHttpRequest` (assign `globalThis.XMLHttpRequest` in the test): progress events call `onProgress(0.5)`; a 400 JSON body rejects with `ApiClientError` carrying `fields.file`; 401 `TOKEN_EXPIRED` triggers one refresh call then a retry.
- [ ] **Step 2: Run** `npx vitest run tests/unit/lib/upload.test.ts tests/unit/lib/countdown.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Home:** greeting; alert cards (overdue fee in red, deadline < 48 h in amber using `countdown`, results published in green); a next-deadlines list with countdowns; a balance summary card linking to Fees.
  - **Coursework:** one card per assessment (module, title, window badge, countdown, current submission + version + Late badge) with a dropzone (drag-and-drop or click; client check; progress bar; the late warning shown *before* submit, with the "Submit late" button label; the resubmission note).
  - **Fees:** a statement table (charges and payments in date order with a running balance), summary stat cards, and overdue/credit notices.
  - **Results:** withheld → an `Alert` with the shared reason, or "Your results are not available yet. Please contact the Registry office."; published → the marksheet table, classification and average, plus a "Print" button (`window.print()` with print styles that hide the shell).
  - **Loading:** `Skeleton` layouts.
- [ ] **Step 4: Run** tests + full checks. Expected: clean.
- [ ] **Step 5: Commit** `feat(ui): student portal with deadline countdowns and drag-and-drop upload`

---

### Task 8: Remove v1 styling, restyle boundaries, Playwright smoke

**Files:**
- Modify: `src/app/globals.css` (delete `.input`, `.btn*`, `.link`, `table.data` rules), `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`, `src/app/page.tsx`
- Delete: `src/components/ui.tsx`, `src/components/forms.tsx` (once nothing imports them)
- Create: `playwright.config.ts`, `tests/browser/smoke.spec.ts`, `tests/unit/ui/no-legacy-ui.test.ts`
- Modify: `package.json` (script `test:browser`), `.gitignore` (`playwright-report/`, `test-results/`), `vitest.config.mts` (exclude `tests/browser`), `README.md` (one line under Testing: how to run `npm run test:browser`)

**Interfaces:**
- Consumes: seeded demo accounts (`admin@demo.sms`, `finance@demo.sms`, `academic@demo.sms`, `amelia.clarke@student.example.ac.uk`, password `DEMO_PASSWORD`), `DEMO_MODE=true` for the demo cards.

- [ ] **Step 1: Write failing tests**
  - `no-legacy-ui.test.ts`: reads every `.tsx` under `src/` and asserts none matches `/className="[^"]*\b(btn|btn-primary|btn-secondary|input|link)\b/`, `/className="data"/`, or imports `@/components/ui"` / `@/components/forms"` (the old module paths, matched with the closing quote so `@/components/ui/button` is fine).
  - `tests/browser/smoke.spec.ts` (Playwright, `baseURL` `http://localhost:3100`). For each of the four demo roles: open `/login`, click that role's demo card, expect the role's home, then visit every sidebar link and expect a visible `h1`. There must be zero `console` errors and zero `pageerror` events across the run. Also:
    - with viewport 390×844, the menu button opens the sidebar sheet and a link navigates;
    - switching to Dark adds `class="dark"` on `<html>` and survives a reload;
    - FINANCE visiting `/staff/results` is redirected away (no page renders);
    - `/staff/students?page=0&sort=bogus` renders the invalid-filters notice.
- [ ] **Step 2: Run** `npx vitest run tests/unit/ui/no-legacy-ui.test.ts`. Expected: FAIL (old modules still exist). Run `npm run test:browser`. Expected: specific failures to fix, or pass.
- [ ] **Step 3: Implement.**
  - `npm i -D @playwright/test && npx playwright install chromium`.
  - `playwright.config.ts`: `testDir: "tests/browser"`, one `chromium` project, `webServer: { command: "NEXT_DIST_DIR=.next-verify npx next build && NEXT_DIST_DIR=.next-verify npx next start -p 3100", url: "http://localhost:3100/api/health", reuseExistingServer: true, timeout: 240_000, env: { DEMO_MODE: "true" } }`.
  - Script: `"test:browser": "playwright test"`.
  - Restyle `error.tsx` / `not-found.tsx` / `global-error.tsx` as centred cards (`global-error` keeps inline-safe markup, since it renders outside the root layout).
  - Remove the legacy CSS and modules, and fix whatever the guard test finds.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit`, `npx eslint .`, `npm run db:seed` (dev DB), `npm run test:browser`. Expected: all green. Also look at the Playwright trace screenshots for each role in light and dark to check layout by eye.
- [ ] **Step 5: Commit** `feat(ui): remove v1 styling, restyle error pages, Playwright smoke across all roles`, push `v2`, and confirm the CI run is green with `gh run watch`.

---

## Self-review notes

- Spec coverage for phase 2:
  - §5.3: shell (T1), dark mode (T1), data tables (T3), forms/toasts (T2), mobile sheet (T1, T8).
  - §5.4 staff pages: dashboard structure (T6), students (T3), student record (T4), assessments (T5), results release (T6).
  - §5.5 portal: home, coursework, fees, results, account (T2, T7).
  - §5.7 demo buttons (T2).
  - Deferred by priority order: ⌘K, charts, 360° coursework/timeline tabs (phase 3); bell, receipts, CSV, bulk (phase 4); finance ledger, audit, users (phase 6).
- Type names used across tasks: `ShellUser`, `NavGroup`, `TableState`, `useApiForm`, `describeError`, `studentTabsFor`/`resolveTab` (T4 declares both), `BreadcrumbTitle`.
- Playwright moves earlier than spec §7 (phase 5) on purpose. A full UI rewrite with no browser check would break the anti-goal "nothing broken". Phase 5 extends this suite with the headline flows and screenshots.
