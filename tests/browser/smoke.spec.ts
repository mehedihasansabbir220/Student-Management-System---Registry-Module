import { expect, test, type Page } from "@playwright/test";

/** Every console error or uncaught exception fails the test (hydration mismatches, broken client code…). */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function signInAs(page: Page, role: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: `Sign in as ${role}` }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/staff") || u.pathname.startsWith("/me"));
}

const ROLES = [
  { role: "Registry Admin", home: "/staff", links: ["/staff", "/staff/students", "/staff/assessments", "/staff/results"] },
  { role: "Finance Officer", home: "/staff", links: ["/staff", "/staff/students"] },
  { role: "Academic Staff", home: "/staff", links: ["/staff", "/staff/students", "/staff/assessments"] },
  { role: "Student", home: "/me", links: ["/me", "/me/assessments", "/me/fees", "/me/results"] },
];

for (const { role, home, links } of ROLES) {
  test(`${role}: demo sign-in, every sidebar page renders without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await signInAs(page, role);
    await expect(page).toHaveURL(new RegExp(`${home}$`));

    // The sidebar (brand link → home, plus nav items) is exactly the role's navigation.
    const sidebarLinks = await page.locator('[data-sidebar="menu-button"][href]').evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect([...new Set(sidebarLinks)].sort()).toEqual([...links].sort());

    for (const href of links) {
      await page.goto(href);
      await expect(page.locator("main h1").first()).toBeVisible();
    }
    // Account page is reached from the user menu.
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Account" }).click();
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();

    expect(errors).toEqual([]);
  });
}

test("record pages open for staff: student tabs and an assessment roster", async ({ page }) => {
  const errors = watchErrors(page);
  await signInAs(page, "Registry Admin");
  await page.goto("/staff/students");
  await page.locator("main a[href^='/staff/students/']").first().click();
  for (const tab of ["Finance", "Coursework", "Results", "Activity", "Overview"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("data-state", "active");
  }
  await page.goto("/staff/assessments");
  await page.locator("main a[href^='/staff/assessments/']").first().click();
  await expect(page.getByText("Submissions & marks")).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile: the sidebar opens as a sheet and navigates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchErrors(page);
  await signInAs(page, "Registry Admin");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Students" }).click();
  await expect(page).toHaveURL(/\/staff\/students$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // No horizontal page scroll on a phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("dark mode is applied and survives a reload", async ({ page }) => {
  await signInAs(page, "Registry Admin");
  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("finance is kept out of results release", async ({ page }) => {
  await signInAs(page, "Finance Officer");
  await page.goto("/staff/results");
  await expect(page).not.toHaveURL(/\/staff\/results/);
});

test("a hand-edited students link shows a notice instead of failing", async ({ page }) => {
  const errors = watchErrors(page);
  await signInAs(page, "Registry Admin");
  await page.goto("/staff/students?page=0&sort=bogus");
  await expect(page.getByText("Some filters in the link were invalid")).toBeVisible();
  expect(errors).toEqual([]);
});
