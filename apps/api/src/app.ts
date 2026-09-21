import { prisma } from "@kleentoditee/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { isEmailDeliveryConfigured } from "./lib/email.js";
import { adminEmailRoutes } from "./routes/admin-email.js";
import { adminUserRoutes } from "./routes/admin-users.js";
import { authRoutes } from "./routes/auth.js";
import { auditRoutes } from "./routes/audit.js";
import { financeRoutes } from "./routes/finance.js";
import { financeBillsRoutes } from "./routes/finance-bills.js";
import { financeBillPaymentsRoutes } from "./routes/finance-bill-payments.js";
import { financeDepositsRoutes } from "./routes/finance-deposits.js";
import { financeExpensesRoutes } from "./routes/finance-expenses.js";
import { financeInvoicesRoutes } from "./routes/finance-invoices.js";
import { financeBankingRoutes } from "./routes/finance-banking.js";
import { financeStatementRoutes } from "./routes/finance-statements.js";
import { financeReportsRoutes } from "./routes/finance-reports.js";
import { financeJournalRoutes, fiscalPeriodRoutes } from "./routes/finance-journals.js";
import { financePaymentsRoutes } from "./routes/finance-payments.js";
import { peopleRoutes } from "./routes/people.js";
import { payrollRoutes } from "./routes/payroll.js";
import { quickBooksImportRoutes } from "./routes/quickbooks-imports.js";
import { settingsRoutes } from "./routes/settings.js";
import { staffRequestRoutes } from "./routes/staff-requests.js";
import { staffRoutes } from "./routes/staff.js";
import { adminStaffRoutes } from "./routes/admin-staff.js";
import { timeRoutes } from "./routes/time.js";

const app = new Hono();

app.use("*", secureHeaders());

function allowedCorsOrigins(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

app.use(
  "*",
  cors({
    // Admin runs on 3000/3001. Next.js also serves "Network" URLs (192.168…, 127.0.0.1) — those must
    // be allowed or the browser blocks fetch() to :8787 and the login page shows "Cannot reach the API."
    origin: (origin) => {
      if (process.env.NODE_ENV === "production") {
        const allowed = allowedCorsOrigins();
        const fallback = allowed[0];
        if (origin && allowed.includes(origin)) {
          return origin;
        }
        return fallback;
      }
      return origin ?? "http://localhost:3000";
    },
    // x-kt-csrf: double-submit CSRF header required on mutating requests (Batch 2).
    // credentials: cookie sessions (kt_session) require it on cross-origin deployments.
    // Bearer auth remains for server-side ops scripts only (smoke-*.mjs, check-tracker-login);
    // browser apps authenticate exclusively with the HttpOnly cookie.
    allowHeaders: ["Content-Type", "Authorization", "x-kt-csrf"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true
  })
);

app.get("/", (c) =>
  c.html(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>KleenToDiTee API</title>
<style>body{font-family:system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem;line-height:1.5;background:#0f172a;color:#e2e8f0}
a{color:#5eead4}code{color:#cbd5e1}</style></head>
<body>
<h1>KleenToDiTee API (backend)</h1>
<p>This port serves JSON for the <strong>admin app</strong> and clients — not the browser UI.</p>
<p><strong>Admin sign-in &amp; dashboard:</strong> <a href="http://localhost:3000">http://localhost:3000</a></p>
<p>Routes: <code>GET /health</code> · <code>/auth/*</code> (incl. invite accept) · <code>/admin/*</code> · <code>/people/*</code> · <code>/time/*</code> · <code>/payroll/*</code> · <code>/staff/*</code> · <code>/finance/*</code> · <code>/audit/*</code></p>
</body></html>`
  )
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "kleentoditee-api",
    time: new Date().toISOString()
  })
);

app.get("/health/ready", async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [queued, failed] = await Promise.all([
      prisma.emailMessage.count({ where: { status: "QUEUED" } }),
      prisma.emailMessage.count({ where: { status: "FAILED" } })
    ]);
    return c.json({
      ok: true,
      database: "ready",
      email: {
        delivery: isEmailDeliveryConfigured() ? "configured" : "not_configured",
        queued,
        failed
      },
      documentStorage: process.env.OBJECT_STORAGE_PROVIDER?.trim() || "local"
    });
  } catch {
    return c.json({ ok: false, database: "unavailable" }, 503);
  }
});

// Local debugging: which DB file / URL this API is using, and how many users exist.
// If userCount is 0 after `npm run db:seed`, seed and API are not sharing the same DATABASE_URL
// (or seed failed). Use the same .env in repo root for both, or stop the API before seeding
// to avoid SQLite lock.
if (process.env.NODE_ENV !== "production") {
  app.get("/dev/db-status", async (c) => {
    try {
      const userCount = await prisma.user.count();
      const first = userCount > 0 ? await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { email: true } }) : null;
      return c.json({
        userCount,
        firstUserEmail: first?.email ?? null,
        databaseUrl: process.env.DATABASE_URL ?? null,
        jwtSecretSet: Boolean(process.env.JWT_SECRET),
        dbError: null
      });
    } catch (e) {
      return c.json({
        userCount: null,
        firstUserEmail: null,
        databaseUrl: process.env.DATABASE_URL ?? null,
        jwtSecretSet: Boolean(process.env.JWT_SECRET),
        dbError: e instanceof Error ? e.message : "unknown"
      });
    }
  });
}

app.route("/auth", authRoutes);
app.route("/admin", adminEmailRoutes);
app.route("/admin", adminUserRoutes);
app.route("/admin", adminStaffRoutes);
app.route("/audit", auditRoutes);
app.route("/finance", financeRoutes);
app.route("/finance", financeInvoicesRoutes);
app.route("/finance", financeReportsRoutes);
app.route("/finance", financeBillsRoutes);
app.route("/finance", financePaymentsRoutes);
app.route("/finance", financeBillPaymentsRoutes);
app.route("/finance", financeExpensesRoutes);
app.route("/finance", financeDepositsRoutes);
app.route("/finance", financeJournalRoutes);
app.route("/finance", fiscalPeriodRoutes);
app.route("/finance", financeBankingRoutes);
app.route("/finance", financeStatementRoutes);
app.route("/imports", quickBooksImportRoutes);
app.route("/people", peopleRoutes);
app.route("/payroll", payrollRoutes);
app.route("/settings", settingsRoutes);
app.route("/time", timeRoutes);
app.route("/staff", staffRoutes);
app.route("/", staffRequestRoutes);

export { app };
