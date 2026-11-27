/**
 * End-to-end smoke test against a RUNNING server with seeded data.
 *   npm run build && npm start   (or npm run dev)
 *   npm run db:seed
 *   npm run test:e2e             (E2E_BASE_URL defaults to http://localhost:3000)
 * Read-only apart from the role toggle, so it is safe to run against the dev DB.
 */
import { beforeAll, describe, expect, it } from "vitest";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

async function signIn(body: object) {
  const res = await fetch(`${BASE}/api/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  expect(res.status).toBe(200);
  return res.headers.get("set-cookie")!.split(";")[0];
}

const get = (path: string, cookie?: string) => fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });

let staff: string;
let students: { id: string; fullName: string; studentNumber: string }[];

beforeAll(async () => {
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) throw new Error(`Server not reachable at ${BASE} — start it first (see file header).`);
  staff = await signIn({ role: "STAFF" });
  const res = await get("/api/students?pageSize=100", staff);
  students = (await res.json()).items;
  if (students.length < 5) throw new Error("Seed data missing — run `npm run db:seed`.");
});

describe("access control (middleware + server guards)", () => {
  it("anonymous visitors to staff pages are redirected to the role picker", async () => {
    const res = await get("/staff");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/$/);
  });

  it("a student cannot open staff pages", async () => {
    const cookie = await signIn({ role: "STUDENT", studentId: students[0].id });
    const res = await get("/staff/students", cookie);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/me$/);
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
    ["/staff/students/new", "Enrol a student"],
    ["/staff/assessments", "Programming Portfolio"],
    ["/staff/results", "Results release"],
  ])("%s", async (path, text) => {
    const res = await get(path, staff);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(text);
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
    const amelia = students.find((s) => s.fullName === "Amelia Clarke")!;
    const cookie = await signIn({ role: "STUDENT", studentId: amelia.id });
    const html = await (await get("/me/results", cookie)).text();
    expect(html).toContain("72");
    expect(html).toContain("Distinction");
  });

  it("a withheld student sees no marks — and the shared reason", async () => {
    const oliver = students.find((s) => s.fullName === "Oliver Bennett")!;
    const cookie = await signIn({ role: "STUDENT", studentId: oliver.id });
    const html = await (await get("/me/results", cookie)).text();
    expect(html).toContain("not available yet");
    expect(html).toContain("Outstanding tuition fees");
    expect(html).not.toContain("Programming Portfolio");
  });

  it.each(["/me", "/me/fees", "/me/assessments"])("%s renders", async (path) => {
    const cookie = await signIn({ role: "STUDENT", studentId: students[0].id });
    expect((await get(path, cookie)).status).toBe(200);
  });

  it("a withdrawn student is told they cannot submit", async () => {
    const hannah = students.find((s) => s.fullName === "Hannah Lee")!;
    const cookie = await signIn({ role: "STUDENT", studentId: hannah.id });
    const html = await (await get("/me/assessments", cookie)).text();
    expect(html).toContain("withdrawn");
  });
});

describe("404s", () => {
  it("unknown assessment returns a real 404 status", async () => {
    expect((await get("/staff/assessments/does-not-exist", staff)).status).toBe(404);
  });
});
