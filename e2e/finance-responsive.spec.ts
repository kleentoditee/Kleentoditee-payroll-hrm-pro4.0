import { expect, test, type Page, type TestInfo } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@kleentoditee.local";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe!Dev123";

const FINANCE_ROUTES = [
  { path: "/dashboard/finance", heading: "Overview", section: "Overview" },
  { path: "/dashboard/finance/customers", heading: "Customers", section: "Sales" },
  { path: "/dashboard/finance/products", heading: "Products & services", section: "Sales" },
  { path: "/dashboard/finance/invoices", heading: "Invoices", section: "Sales" },
  { path: "/dashboard/finance/payments", heading: "Customer payments", section: "Sales" },
  { path: "/dashboard/finance/suppliers", heading: "Suppliers", section: "Purchases" },
  { path: "/dashboard/finance/bills", heading: "Bills", section: "Purchases" },
  { path: "/dashboard/finance/bill-payments", heading: "Bill payments", section: "Purchases" },
  { path: "/dashboard/finance/expenses", heading: "Expenses", section: "Purchases" },
  { path: "/dashboard/finance/deposits", heading: "Deposits", section: "Banking" },
  { path: "/dashboard/finance/statements", heading: "Bank statements", section: "Banking" },
  { path: "/dashboard/finance/reconciliations", heading: "Bank reconciliation", section: "Banking" },
  { path: "/dashboard/finance/register", heading: "Bank register", section: "Banking" },
  { path: "/dashboard/finance/accounts", heading: "Chart of accounts", section: "Accounting" },
  { path: "/dashboard/finance/journal", heading: "General journal", section: "Accounting" },
  { path: "/dashboard/finance/journals", heading: "Manual journals", section: "Accounting" },
  { path: "/dashboard/finance/periods", heading: "Fiscal periods", section: "Accounting" },
  { path: "/dashboard/finance/financial-statements", heading: "Financial statements", section: "Reports & compliance" },
  { path: "/dashboard/finance/trial-balance", heading: "Trial balance", section: "Reports & compliance" },
  { path: "/dashboard/finance/aging", heading: "AR / AP aging", section: "Reports & compliance" },
  { path: "/dashboard/finance/year-end", heading: "Year-end close", section: "Reports & compliance" },
  { path: "/dashboard/finance/filing", heading: "BVI filing support", section: "Reports & compliance" }
] as const;

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }));
  expect(dimensions.documentWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.bodyWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(`${testInfo.project.name}-${name}`, { body: screenshot, contentType: "image/png" });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
});

test("every finance destination is reachable without page overflow", async ({ page }, testInfo) => {
  const compact = (testInfo.project.use.viewport?.width ?? 1440) < 1024;

  for (const route of FINANCE_ROUTES) {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { name: route.heading, exact: true }).first()).toBeVisible();
    await expectNoPageOverflow(page);

    if (compact) {
      await expect(page.getByRole("button", { name: `Finance · ${route.section}`, exact: true })).toBeVisible();
    } else {
      const sectionNav = page.getByRole("navigation", { name: "Finance sections" });
      await expect(sectionNav).toBeVisible();
      await expect(sectionNav.getByRole("link")).toHaveCount(6);
      await expect(sectionNav.getByRole("link", { name: route.section, exact: true })).toHaveAttribute("aria-current", "page");
    }
  }

  await page.goto("/dashboard/finance/statements");
  await capture(page, testInfo, "bank-statements");
});

test("sidebar keeps finance grouped without losing destinations", async ({ page }, testInfo) => {
  await page.goto("/dashboard/finance/statements");
  const compact = (testInfo.project.use.viewport?.width ?? 1440) < 1024;

  if (compact) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("button", { name: "Close navigation" }).first()).toBeVisible();
  }

  const workspaceNav = page.getByRole("navigation", { name: "Workspaces" });
  await expect(workspaceNav).toBeVisible();
  for (const section of ["Overview", "Sales", "Purchases", "Banking", "Accounting", "Reports & compliance"]) {
    await expect(workspaceNav.getByRole("link", { name: section, exact: true })).toBeVisible();
  }
  await expect(workspaceNav.getByRole("link", { name: "Banking", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(workspaceNav.getByRole("link", { name: "Overview", exact: true })).not.toHaveAttribute("aria-current", "page");
  await expect(workspaceNav.getByRole("link", { name: "Invoices", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "All apps" }).click();
  const launcher = page.getByRole("dialog", { name: "All apps" });
  const filter = launcher.getByPlaceholder("Filter apps");
  for (const destination of ["Invoices", "Bank register", "Year-end close", "Finance reports"]) {
    await filter.fill(destination);
    await expect(launcher.getByRole("link", { name: destination, exact: true })).toBeVisible();
  }
  await launcher.getByRole("button", { name: "Close All apps" }).last().click();

  if (compact) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Close navigation" })).toHaveCount(0);
  }
});

test("finance list state survives refresh and uses URL query parameters", async ({ page }) => {
  await page.goto("/dashboard/finance/accounts");
  const search = page.getByPlaceholder("Search by code or name");
  await search.fill("cash");
  await expect(page).toHaveURL(/[?&]q=cash(?:&|$)/, { timeout: 5_000 });

  const typeFilter = page.getByLabel("Filter by account type");
  await typeFilter.selectOption("asset");
  await expect(page).toHaveURL(/[?&]type=asset(?:&|$)/);
  await page.getByLabel("Rows per page").selectOption("50");
  await expect(page).toHaveURL(/[?&]pageSize=50(?:&|$)/);

  await page.reload();
  await expect(search).toHaveValue("cash");
  await expect(typeFilter).toHaveValue("asset");
  await expect(page.getByLabel("Rows per page")).toHaveValue("50");
  await expectNoPageOverflow(page);
});

test("editable accounting screens remain usable without page overflow", async ({ page }, testInfo) => {
  const phoneCards = (testInfo.project.use.viewport?.width ?? 1440) < 768;
  await page.goto("/dashboard/finance/journals");
  await page.getByRole("button", { name: "New journal" }).click();
  if (phoneCards) {
    await expect(page.getByText("Journal line 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Journal line 2", { exact: true })).toBeVisible();
  } else {
    await expect(page.getByLabel("Account for line 1")).toBeVisible();
    await expect(page.getByLabel("Account for line 2")).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Add line" })).toBeVisible();
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "manual-journal-editor");

  await page.goto("/dashboard/finance/register");
  await expect(page.getByRole("heading", { name: "Bank register" })).toBeVisible();
  await expect(page.getByLabel("Rows per page")).toBeVisible();
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "bank-register");
});
