/**
 * Tracker login diagnostic (safe: never prints password or JWT).
 *
 * Defaults match seed: maria.tracker@kleentoditee.local + ChangeMe!Dev123
 * (override with TRACKER_EMAIL / TRACKER_PASSWORD).
 *
 * Usage:
 *   API_BASE=http://127.0.0.1:8787 node scripts/check-tracker-login.mjs
 */

const API_BASE = (process.env.API_BASE ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const TRACKER_EMAIL = (process.env.TRACKER_EMAIL ?? "maria.tracker@kleentoditee.local").trim().toLowerCase();
const TRACKER_PASSWORD = process.env.TRACKER_PASSWORD ?? "ChangeMe!Dev123";

let failed = false;

function fail(msg) {
  console.error(msg);
  failed = true;
}

async function main() {
  console.log("API_BASE:", API_BASE);
  console.log("Email:", TRACKER_EMAIL, "(password from env or default — not printed)");

  const healthRes = await fetch(`${API_BASE}/health`);
  const healthText = await healthRes.text();
  let healthJson = null;
  try {
    healthJson = JSON.parse(healthText);
  } catch {
    /* ignore */
  }
  console.log("GET /health:", healthRes.status, healthJson ?? healthText.slice(0, 120));
  if (!healthRes.ok) {
    fail("Health check failed — is the API running on this base URL?");
    process.exit(1);
  }

  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TRACKER_EMAIL, password: TRACKER_PASSWORD })
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  const token = typeof loginBody.token === "string" ? loginBody.token : null;
  console.log("POST /auth/login:", loginRes.status, {
    code: loginBody.code ?? null,
    error: loginBody.error ?? null,
    hasToken: Boolean(token),
    roles: loginBody.user?.roles ?? null,
    employeeId: loginBody.user?.employeeId ?? null
  });
  if (!loginRes.ok || !token) {
    fail("Login failed — wrong password, user missing, invited-but-not-accepted, or wrong API/DB.");
    process.exit(1);
  }

  const meRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const meBody = await meRes.json().catch(() => ({}));
  const roles = meBody.user?.roles ?? [];
  const employeeId = meBody.user?.employeeId ?? null;
  console.log("GET /auth/me:", meRes.status, {
    roles,
    employeeId,
    status: meBody.user?.status ?? null
  });
  if (!meRes.ok) {
    fail("/auth/me failed after login.");
  }

  const hasTracker = roles.includes("employee_tracker_user");
  console.log("Has employee_tracker_user role:", hasTracker);
  if (!hasTracker) {
    fail("User lacks employee_tracker_user — tracker routes will return 403.");
  }
  console.log("Employee link on user:", employeeId ? "yes" : "no");
  if (!employeeId) {
    fail("user.employeeId is null — /time/self/* will reject.");
  }

  const profileRes = await fetch(`${API_BASE}/time/self/profile`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const profileText = await profileRes.text();
  let profileJson = null;
  try {
    profileJson = JSON.parse(profileText);
  } catch {
    /* ignore */
  }
  console.log("GET /time/self/profile:", profileRes.status, {
    employeeName: profileJson?.employee?.fullName ?? null,
    employeeActive: profileJson?.employee?.active ?? null,
    error: profileJson?.error ?? null
  });
  if (!profileRes.ok) {
    fail("/time/self/profile failed — role, employee link, or employee record issue.");
  }

  if (failed) {
    process.exit(1);
  }
  console.log("All tracker login checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
