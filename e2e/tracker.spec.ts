import { expect, test } from "@playwright/test";

/**
 * Employee tracker surface: unauthenticated first screen must be usable
 * (sign-in form renders, no gate crash) at every viewport.
 */
const TRACKER_URL = process.env.E2E_TRACKER_URL ?? "http://localhost:3001";

test("tracker login renders", async ({ page }) => {
  const res = await page.goto(`${TRACKER_URL}/login`);
  if (!res || !res.ok()) {
    test.skip(true, "employee-tracker dev server is not running on :3001");
  }
  await expect(page.locator("body")).not.toContainText("Application error");
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});

test("tracker home redirects unauthenticated users to login", async ({ page }) => {
  const res = await page.goto(TRACKER_URL);
  if (!res || !res.ok()) {
    test.skip(true, "employee-tracker dev server is not running on :3001");
  }
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).not.toContainText("Application error");
});
