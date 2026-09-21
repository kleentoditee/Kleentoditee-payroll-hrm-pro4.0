import { expect, test } from "@playwright/test";

/**
 * Role workflow smoke: platform admin signs in (cookie session), reaches the
 * dashboard, and opens the core finance/payroll/admin screens. Runs across the
 * desktop/tablet/phone projects for responsive coverage.
 *
 * Credentials come from env (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD) with the
 * development seed account as default — never a production account.
 */
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@kleentoditee.local";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe!Dev123";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
});

test("admin sign-in reaches the dashboard", async ({ page }) => {
  await expect(page.getByText("KleenToDiTee platform")).toBeVisible();
});

test("finance statements render with all four tabs", async ({ page }) => {
  await page.goto("/dashboard/finance/financial-statements");
  await expect(page.getByRole("heading", { name: "Financial statements" })).toBeVisible();
  await expect(page.getByText("Profit & loss")).toBeVisible();
  await expect(page.getByText("Balance sheet")).toBeVisible();
  await expect(page.getByText("Cash flow")).toBeVisible();
  await expect(page.getByText("Changes in equity")).toBeVisible();
});

test("year-end close page renders the workflow", async ({ page }) => {
  await page.goto("/dashboard/finance/year-end");
  await expect(page.getByRole("heading", { name: "Year-end close" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create draft close" })).toBeVisible();
});

test("filing support page shows support-only banner", async ({ page }) => {
  await page.goto("/dashboard/finance/filing");
  await expect(page.getByRole("heading", { name: "BVI filing support" })).toBeVisible();
  await expect(page.getByText(/Filing support only/)).toBeVisible();
});

test("email queue page renders delivery summary", async ({ page }) => {
  await page.goto("/dashboard/email-queue");
  await expect(page.getByRole("heading", { name: "Email queue" })).toBeVisible();
  await expect(page.getByText(/SMTP/)).toBeVisible();
});

test("people directory is reachable", async ({ page }) => {
  await page.goto("/dashboard/people/employees");
  await expect(page).toHaveURL(/people\/employees/);
  await expect(page.locator("body")).not.toContainText("Application error");
});
