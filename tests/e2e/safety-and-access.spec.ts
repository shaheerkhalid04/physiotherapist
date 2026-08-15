import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PATIENT_PHONE = "+920000000010";
const PATIENT_PIN = "0000";
const STAFF_EMAIL = "surgeon@example.test";
const STAFF_PASSWORD = "development-only";

async function signInAsPatient(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Phone number").fill(PATIENT_PHONE);
  await page.getByText("I cannot receive a code").click();
  await page.getByLabel("PIN").fill(PATIENT_PIN);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/today/);
}

async function signInAsStaff(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(STAFF_EMAIL);
  await page.getByLabel("Password").fill(STAFF_PASSWORD);
  await page.getByRole("button", { name: "Sign in as staff" }).click();
  await expect(page).toHaveURL(/\/worklist/);
}

test.describe("patient safety surface", () => {
  test("the disclaimer footer is present and has no dismiss control", async ({ page }) => {
    await signInAsPatient(page);

    for (const path of ["/today", "/progress"]) {
      await page.goto(path);
      const footer = page.getByTestId("safety-footer");
      await expect(footer).toBeVisible();
      await expect(footer.getByRole("button")).toHaveCount(0);
    }
  });

  test("the something is wrong control is reachable and escalates", async ({ page }) => {
    await signInAsPatient(page);
    await page.getByTestId("concern-button").click();
    await page.getByTestId("concern-send").click();
    await expect(page.getByTestId("concern-sent")).toBeVisible();
  });

  test("a patient cannot reach the clinician worklist", async ({ page }) => {
    await signInAsPatient(page);
    await page.goto("/worklist");
    await expect(page).toHaveURL(/\/today/);
  });

  test("an unauthenticated visitor cannot reach patient or clinic routes", async ({ page }) => {
    for (const path of ["/today", "/worklist"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });
});

test.describe("clinician worklist", () => {
  test("the most urgent patient is the first row", async ({ page }) => {
    await signInAsStaff(page);
    const rows = page.getByTestId("worklist-row");
    const count = await rows.count();
    test.skip(count === 0, "No patients seeded");

    const bands = await rows.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-band")),
    );
    const order = ["URGENT", "REVIEW", "OUTREACH", "ONTRACK"];
    const ranks = bands.map((band) => order.indexOf(band ?? "ONTRACK"));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  test("severity is conveyed by text as well as colour", async ({ page }) => {
    await signInAsStaff(page);
    const first = page.getByTestId("worklist-row").first();
    test.skip((await page.getByTestId("worklist-row").count()) === 0, "No patients seeded");
    await expect(first).toContainText(/Urgent|Review|Outreach|On track/);
  });
});

test.describe("accessibility", () => {
  for (const path of ["/login", "/today"]) {
    test(`${path} has no serious or critical WCAG 2.1 AA violations`, async ({ page }) => {
      if (path !== "/login") await signInAsPatient(page);
      await page.goto(path);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const serious = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );

      expect(
        serious,
        serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n"),
      ).toEqual([]);
    });
  }
});
