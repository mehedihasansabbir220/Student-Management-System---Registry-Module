/**
 * End-to-end smoke test against a RUNNING server with seeded data.
 *   npm run build && npm start   (or npm run dev)
 *   npm run db:seed
 *   npm run test:e2e             (E2E_BASE_URL defaults to http://localhost:3000)
 * Uses the seeded demo accounts (DEMO_PASSWORD, default Demo@12345). Read-only
 * apart from signing in, so it is safe to run against the dev DB.
 */
import { beforeAll, describe, expect, it } from "vitest";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo@12345";
const ACCOUNTS = {
  admin: "admin@demo.sms",
  finance: "finance@demo.sms",
  academic: "academic@demo.sms",
  amelia: "amelia.clarke@student.example.ac.uk",
  oliver: "oliver.bennett@student.example.ac.uk",
  hannah: "hannah.lee@student.example.ac.uk",
} as const;

/** Real sign-in through the API; returns a Cookie header carrying the issued cookies. */
async function signIn(who: keyof typeof ACCOUNTS) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250) + 1}` },
    body: JSON.stringify({ email: ACCOUNTS[who], password: PASSWORD }),
  });
  expect(res.status).toBe(200);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

const get = (path: string, cookie?: string) => fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });

let staff: string;
let students: { id: string; fullName: string; studentNumber: string }[];

beforeAll(async () => {
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) throw new Error(`Server not reachable at ${BASE} — start it first (see file header).`);
  staff = await signIn("admin");
  const res = await get("/api/students?pageSize=100", staff);
  students = (await res.json()).items;
  if (students.length < 5) throw new Error("Seed data missing — run `npm run db:seed`.");
});

describe("access control (middleware + server guards)", () => {
  it("anonymous visitors to staff pages are sent to sign in, with a way back", async () => {
    const res = await get("/staff");
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!, BASE); // Location may be relative
    expect(loc.pathname + loc.search).toBe("/login?next=%2Fstaff");
  });

  it("an expired access token with a live session goes through a silent refresh", async () => {
    const res = await get("/staff", "sms_has_rt=1; sms_at=expired.or.garbage");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/api/auth/refresh?next=%2Fstaff");
  });

  it("a student cannot open staff pages", async () => {
    const cookie = await signIn("amelia");
    const res = await get("/staff/students", cookie);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/me$/);
  });

  it("the login page offers demo accounts", async () => {
    const html = await (await get("/login")).text();
    // One-click sign-in for each seeded role (DEMO_MODE).
    for (const role of ["Registry Admin", "Finance Officer", "Academic Staff", "Student"]) expect(html).toContain(`Sign in as ${role}`);
  });

  it("Finance sees the overdue dashboard but not the results-release area", async () => {
    const cookie = await signIn("finance");
    const html = await (await get("/staff", cookie)).text();
    expect(html).toContain("Overdue balances");
    expect(html).not.toContain('href="/staff/results"');
    expect((await get("/staff/results", cookie)).status).toBe(307);
  });

  it("Academic staff never see a student's finances", async () => {
    const cookie = await signIn("academic");
    const oliver = students.find((s) => s.fullName === "Oliver Bennett")!;
    const html = await (await get(`/staff/students/${oliver.id}`, cookie)).text();
    expect(html).toContain(oliver.studentNumber);
    expect(html).not.toContain("Fees &amp; payments");
    expect(html).toContain("Results");
  });

  it("every response carries a request id for log correlation", async () => {
    expect((await get("/api/health")).headers.get("x-request-id")).toBeTruthy();
  });
});

describe("staff pages render", () => {
  it.each([
    ["/staff", "Overdue balances"],
    ["/staff/students", "Students"],
    ["/staff/students?status=WITHDRAWN", "Hannah Lee"],
    ["/staff/students?q=okafor", "Daniel Okafor"],
    ["/staff/assessments", "Programming Portfolio"],
    ["/staff/results", "Results release"],
  ])("%s", async (path, text) => {
    const res = await get(path, staff);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(text);
  });

  it("the old enrol URL opens the enrol sheet on the students list", async () => {
    const res = await get("/staff/students/new", staff);
    expect(res.status).toBe(307);
    const to = new URL(res.headers.get("location")!, BASE);
    expect(`${to.pathname}${to.search}`).toBe("/staff/students?enrol=1");
  });

  it("dashboard flags the overdue students from the seed", async () => {
    const html = await (await get("/staff", staff)).text();
    for (const name of ["Oliver Bennett", "Daniel Okafor", "Hannah Lee"]) expect(html).toContain(name);
  });

  it("student profile and assessment roster render", async () => {
    const oliver = students.find((s) => s.fullName === "Oliver Bennett")!;
    const profile = await (await get(`/staff/students/${oliver.id}`, staff)).text();
    expect(profile).toContain(oliver.studentNumber);
    expect(profile).toContain("Overdue");
    expect(profile).toContain("Late");

    const list = await (await get("/api/assessments", staff)).json();
    const res = await get(`/staff/assessments/${list.items[0].id}`, staff);
    expect(res.status).toBe(200);
  });

  it("unknown student shows the 404 page, not a crash", async () => {
    const res = await get("/staff/students/does-not-exist", staff);
    expect(res.status).toBe(404);
  });
});

describe("student pages render and respect release status", () => {
  it("a published student sees their marks", async () => {
    const cookie = await signIn("amelia");
    const html = await (await get("/me/results", cookie)).text();
    expect(html).toContain("72");
    expect(html).toContain("Distinction");
  });

  it("a withheld student sees no marks — and the shared reason", async () => {
    const cookie = await signIn("oliver");
    const html = await (await get("/me/results", cookie)).text();
    expect(html).toContain("not available yet");
    expect(html).toContain("Outstanding tuition fees");
    expect(html).not.toContain("Programming Portfolio");
  });

  it.each(["/me", "/me/fees", "/me/assessments"])("%s renders", async (path) => {
    const cookie = await signIn("amelia");
    expect((await get(path, cookie)).status).toBe(200);
  });

  it("a withdrawn student can still sign in, but is told they cannot submit", async () => {
    const cookie = await signIn("hannah");
    const html = await (await get("/me/assessments", cookie)).text();
    expect(html).toContain("withdrawn");
  });
});

describe("404s", () => {
  it("unknown assessment returns a real 404 status", async () => {
    expect((await get("/staff/assessments/does-not-exist", staff)).status).toBe(404);
  });
});
