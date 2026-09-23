import { defineConfig, devices } from "@playwright/test";

/**
 * Batch 16 e2e: role workflows + responsive checks.
 * Expects the stack already running (API :8787, admin-web :3000, tracker :3001)
 * — the same processes used for development. Set E2E_* env vars to override.
 */
const ADMIN_URL = process.env.E2E_ADMIN_URL ?? "http://localhost:3000";
const TRACKER_URL = process.env.E2E_TRACKER_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 45_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: ADMIN_URL,
    trace: "off",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } }
  ],
  metadata: { ADMIN_URL, TRACKER_URL }
});
