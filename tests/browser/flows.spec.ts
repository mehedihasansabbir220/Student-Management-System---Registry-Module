import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Headline flows that WRITE data, end to end in a real browser. They run
 * against the freshly seeded test database (see global-setup.ts).
 */

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function signInAs(page: Page, role: "Registry Admin" | "Finance Officer" | "Academic Staff") {
  await page.goto("/login");
  await page.getByRole("button", { name: `Sign in as ${role}` }).click();
  await page.waitForURL(/\/staff$/);
}

async function signInStudent(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD ?? "Demo@12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/me$/);
  return page;
}

async function openStudent(page: Page, name: string, tab?: string) {
  await page.goto(`/staff/students?q=${encodeURIComponent(name)}`);
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  if (tab) await page.getByRole("tab", { name: tab }).click();
}

const unique = () => Date.now().toString(36);

test("Registry enrols a student and gets the activation link once", async ({ page }) => {
  const errors = watchErrors(page);
  await signInAs(page, "Registry Admin");
  await page.goto("/staff/students");
  await page.getByRole("button", { name: "Enrol student" }).click();

  const sheet = page.getByRole("dialog");
  const id = unique();
  await sheet.getByLabel("Full name").fill(`Test Student ${id}`);
  await sheet.getByLabel("Email").fill(`test.${id}@example.ac.uk`);
  await sheet.getByLabel("Date of birth").fill("2004-05-06");
  await sheet.getByRole("combobox", { name: "Programme" }).click();
  await page.getByRole("option").first().click();
  await sheet.getByRole("button", { name: "Enrol student" }).click();

  await expect(sheet.getByText("Student enrolled")).toBeVisible();
  await expect(sheet.getByLabel("Student portal activation link")).toHaveValue(/\/activate\?token=/);
  await sheet.getByRole("link", { name: "View student" }).click();
  await expect(page.getByRole("heading", { name: `Test Student ${id}` })).toBeVisible();
  await expect(page.getByText("Invitation pending").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("Finance records a payment and the balance updates", async ({ page }) => {
  const errors = watchErrors(page);
  await signInAs(page, "Finance Officer");
  await openStudent(page, "Oliver Bennett", "Finance");
  const paid = page.getByText("Paid", { exact: true }).locator("xpath=..").locator("div").nth(1);
  const before = await paid.textContent();

  await page.getByRole("button", { name: "Record payment" }).click();
  const dialog = page.getByRole("dialog");
  const ref = `PW-${unique()}`.toUpperCase();
  await dialog.getByLabel("Amount (£)").fill("25.00");
  await dialog.getByLabel("Reference").fill(ref);
  await dialog.getByRole("button", { name: "Record payment" }).click();

  await expect(page.getByText("Payment recorded")).toBeVisible();
  await expect(page.getByRole("cell", { name: ref })).toBeVisible();
  await expect(paid).not.toHaveText(before ?? "");
  expect(errors).toEqual([]);
});

test("a duplicate payment reference is shown on the field, not lost", async ({ page }) => {
  await signInAs(page, "Finance Officer");
  await openStudent(page, "Oliver Bennett", "Finance");
  const existing = (await page.locator("td.font-mono").first().textContent())!.trim();

  await page.getByRole("button", { name: "Record payment" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (£)").fill("10.00");
  await dialog.getByLabel("Reference").fill(existing);
  await dialog.getByRole("button", { name: "Record payment" }).click();

  await expect(dialog.getByRole("alert")).toBeVisible();
  // The dialog stays open with the user's input kept.
  await expect(dialog.getByLabel("Amount (£)")).toHaveValue("10.00");
});

test("Academic creates an assessment and enters a mark with live classification", async ({ page }) => {
  const errors = watchErrors(page);
  await signInAs(page, "Academic Staff");
  await page.goto("/staff/assessments");
  await page.getByRole("button", { name: "Create assessment" }).click();
  const dialog = page.getByRole("dialog");
  const title = `Playwright Essay ${unique()}`;
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("combobox", { name: "Module" }).click();
  await page.getByRole("option").first().click();
  await dialog.getByLabel("Submission deadline").fill("2030-01-15T17:00");
  await dialog.getByRole("button", { name: "Create assessment" }).click();
  await expect(page.getByText("Assessment created")).toBeVisible();

  await page.getByRole("link", { name: title }).click();
  // The deadline was entered as local wall-clock time and comes back the same.
  await expect(page.getByLabel("Deadline (your local time)")).toHaveValue("2030-01-15T17:00");

  const mark = page.getByRole("textbox", { name: /^Mark for / }).first();
  await mark.fill("65");
  await expect(page.getByText("Merit").first()).toBeVisible();
  await mark.press("Enter");
  await expect(page.getByLabel("Saved").first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: /^Mark for / }).first()).toHaveValue("65");
  expect(errors).toEqual([]);
});

test("a student uploads coursework with progress and sees it recorded", async ({ browser }) => {
  const page = await signInStudent(browser, "amelia.clarke@student.example.ac.uk");
  const errors = watchErrors(page);
  await page.goto("/me/assessments");
  await page.waitForLoadState("networkidle");
  const input = page.locator('input[type="file"]').first();
  const label = await input.getAttribute("aria-label");
  const title = label!.replace("Choose a file for ", "");
  await input.setInputFiles({ name: "essay.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") });
  const card = page.locator("[data-slot=card]", { hasText: title });
  await card.getByRole("button", { name: /^(Submit|Resubmit|Submit late)$/ }).click();
  await expect(page.getByText(/^Submitted/)).toBeVisible();
  await expect(card.getByRole("link", { name: "essay.pdf" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a student is told immediately when a file type isn't allowed", async ({ browser }) => {
  const page = await signInStudent(browser, "amelia.clarke@student.example.ac.uk");
  await page.goto("/me/assessments");
  // Let React hydrate before interacting, or the change event is lost.
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByText("Only PDF or DOCX files can be submitted.")).toBeVisible();
});

test("Registry publishes results and the student can then see their marks", async ({ page, browser }) => {
  const errors = watchErrors(page);
  // Priya is graded but her results are withheld (awaiting release) in the seed.
  const priya = await signInStudent(browser, "priya.sharma@student.example.ac.uk");
  await priya.goto("/me/results");
  await expect(priya.getByRole("heading", { name: "Your results are not available yet" })).toBeVisible();

  await signInAs(page, "Registry Admin");
  await page.goto("/staff/results?filter=awaiting");
  const row = page.getByRole("row", { name: /Priya Sharma/ });
  await row.getByRole("button", { name: "Publish results" }).click();
  await expect(page.getByText("Results published")).toBeVisible();

  await priya.reload();
  await expect(priya.getByText("Average")).toBeVisible();
  expect(errors).toEqual([]);
});
