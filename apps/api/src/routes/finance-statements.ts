import {
  JournalEntryStatus,
  ReportSnapshotType,
  Role,
  TransactionStatus,
  YearEndCloseStatus,
  prisma,
  requireOrgId
} from "@kleentoditee/db";
import { Hono } from "hono";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeAudit } from "../lib/audit.js";
import {
  buildAging,
  buildBalanceSheet,
  buildCashFlow,
  buildChangesInEquity,
  buildProfitLoss,
  statementHash,
  statementToCsv,
  type AccountBalance,
  type AgingItem,
  type BalanceSheet,
  type CashFlow,
  type ChangesInEquity,
  type ProfitLoss
} from "../lib/financial-statements.js";
import { round2 } from "../lib/finance-transactions.js";
import { buildYearEndClosingJournal, ensureControlAccounts, postJournal, reverseJournal } from "../lib/gl-posting.js";
import { loadAccountBalances } from "../lib/gl-reports.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const CAN_VIEW = [
  Role.platform_owner,
  Role.hr_admin,
  Role.payroll_admin,
  Role.finance_admin,
  Role.operations_manager,
  Role.site_supervisor
] as const;

const CAN_EDIT = [Role.platform_owner, Role.finance_admin] as const;

// Closing journals and their reversals are not operating activity — operating
// P&L (statements + filing mapping) excludes both.
const CLOSING_SOURCE_TYPES = ["year_end_close", "year_end_close_reversal"];

function parseDate(value: unknown): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text.length === 10 ? `${text}T00:00:00.000Z` : text);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function yearWindow(year: number, fiscalYearEndMonth: number): { from: Date; to: Date } {
  // FY ends on the last day of fiscalYearEndMonth in `year` and starts the day after the prior FYE.
  const to = new Date(Date.UTC(year, fiscalYearEndMonth, 0));
  const from = new Date(Date.UTC(year - 1, fiscalYearEndMonth, 1));
  return { from, to };
}

function shiftYear(d: Date, years: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

// ---------------------------------------------------------------------------
// Snapshot flattening (exports render the LOCKED payload, never recompute)
// ---------------------------------------------------------------------------

type FlatLine = { label: string; amount: number | string; depth?: number };

function flattenSections(title: string, sections: Array<{ subtype: string; accounts: Array<{ name: string; code: string; amount: number }>; total: number }>, out: FlatLine[]) {
  for (const s of sections) {
    out.push({ label: s.subtype, amount: "", depth: 1 });
    for (const a of s.accounts) out.push({ label: `${a.code} ${a.name}`, amount: a.amount, depth: 2 });
    out.push({ label: `Total ${s.subtype}`, amount: s.total, depth: 1 });
  }
}

export function flattenSnapshot(type: string, payload: unknown): FlatLine[] {
  const p = payload as Record<string, unknown>;
  const out: FlatLine[] = [];
  if (type === "profit_loss") {
    const pl = p as unknown as ProfitLoss;
    out.push({ label: `Period ${pl.from} to ${pl.to}`, amount: "" });
    out.push({ label: "Revenue", amount: "" });
    flattenSections("Revenue", pl.revenueSections, out);
    out.push({ label: "Total revenue", amount: pl.totalRevenue });
    out.push({ label: "Expenses", amount: "" });
    flattenSections("Expenses", pl.expenseSections, out);
    out.push({ label: "Total expenses", amount: pl.totalExpenses });
    out.push({ label: "Net income", amount: pl.netIncome });
  } else if (type === "balance_sheet") {
    const bs = p as unknown as BalanceSheet;
    out.push({ label: `As of ${bs.asOf}`, amount: "" });
    out.push({ label: "Assets", amount: "" });
    flattenSections("Assets", bs.assetSections, out);
    out.push({ label: "Total assets", amount: bs.totalAssets });
    out.push({ label: "Liabilities", amount: "" });
    flattenSections("Liabilities", bs.liabilitySections, out);
    out.push({ label: "Total liabilities", amount: bs.totalLiabilities });
    out.push({ label: "Equity", amount: "" });
    for (const a of bs.equityAccounts) out.push({ label: `${a.code} ${a.name}`, amount: a.amount, depth: 2 });
    out.push({ label: "Current earnings", amount: bs.currentEarnings, depth: 2 });
    out.push({ label: "Total equity", amount: bs.totalEquity });
    out.push({ label: "A - (L + E) check", amount: bs.balanceCheck });
  } else if (type === "cash_flow") {
    const cf = p as unknown as CashFlow;
    out.push({ label: `Period ${cf.from} to ${cf.to}`, amount: "" });
    for (const section of [cf.operating, cf.investing, cf.financing]) {
      out.push({ label: section.label, amount: "", depth: 1 });
      for (const l of section.lines) out.push({ label: l.name, amount: l.change, depth: 2 });
      out.push({ label: `Net ${section.label.toLowerCase()}`, amount: section.total, depth: 1 });
    }
    out.push({ label: "Net change in cash", amount: cf.netChangeInCash });
    out.push({ label: "Opening cash", amount: cf.openingCash });
    out.push({ label: "Closing cash", amount: cf.closingCash });
  } else if (type === "changes_in_equity") {
    const eq = p as unknown as ChangesInEquity;
    out.push({ label: `Period ${eq.from} to ${eq.to}`, amount: "" });
    out.push({ label: "Opening equity", amount: eq.openingEquity });
    out.push({ label: "Net income", amount: eq.netIncome });
    out.push({ label: "Owner contributions", amount: eq.ownerContributions });
    out.push({ label: "Owner draws", amount: -eq.ownerDraws });
    out.push({ label: "Closing equity", amount: eq.closingEquity });
  } else if (type === "aging") {
    const rows = (p as { ar: { rows: AgingItem[] }; ap: { rows: AgingItem[] } }).ar.rows;
    const apRows = (p as { ap: { rows: AgingItem[] } }).ap.rows;
    out.push({ label: "Accounts receivable", amount: "" });
    for (const r of rows) out.push({ label: `${r.number} ${r.name}`, amount: r.balance, depth: 1 });
    out.push({ label: "Accounts payable", amount: "" });
    for (const r of apRows) out.push({ label: `${r.number} ${r.name}`, amount: r.balance, depth: 1 });
  } else {
    out.push({ label: "Snapshot payload", amount: JSON.stringify(payload).slice(0, 2000) });
  }
  return out;
}

async function renderSnapshotPdf(title: string, lines: FlatLine[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([612, 792]);
  let y = 760;
  const draw = (text: string, b = false) => {
    if (y < 50) {
      page = doc.addPage([612, 792]);
      y = 760;
    }
    page.drawText(text.slice(0, 95), { x: 50, y, size: 9, font: b ? bold : font, color: rgb(0.1, 0.1, 0.1) });
    y -= 14;
  };
  draw(title, true);
  y -= 6;
  for (const l of lines) {
    const amount = typeof l.amount === "number" ? l.amount.toFixed(2) : l.amount;
    draw(`${"  ".repeat(l.depth ?? 0)}${l.label}${amount !== "" ? `  ${amount}` : ""}`, (l.depth ?? 0) === 0);
  }
  draw("");
  draw("Locked snapshot export — management-prepared, unaudited.", true);
  return doc.save();
}

// ---------------------------------------------------------------------------
// Compute helpers shared by GET endpoints and snapshot creation.
// ---------------------------------------------------------------------------

async function computeStatement(type: ReportSnapshotType, params: { from?: Date; to?: Date; asOf?: Date }): Promise<unknown> {
  if (type === "profit_loss") {
    const from = params.from ?? new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const to = params.to ?? new Date();
    // Operating P&L excludes year-end closing journals — after a close, raw
    // window balances would net revenue/expenses to zero.
    const balances = await loadAccountBalances(from, to, { excludeSourceTypes: CLOSING_SOURCE_TYPES });
    return buildProfitLoss(balances as AccountBalance[], isoDay(from), isoDay(to));
  }
  if (type === "balance_sheet") {
    const asOf = params.asOf ?? new Date();
    const balances = await loadAccountBalances(undefined, asOf);
    return buildBalanceSheet(balances as AccountBalance[], isoDay(asOf));
  }
  if (type === "cash_flow") {
    const from = params.from ?? new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const to = params.to ?? new Date();
    const [opening, closing, period] = await Promise.all([
      loadAccountBalances(undefined, new Date(from.getTime() - 1)),
      loadAccountBalances(undefined, to),
      loadAccountBalances(from, to, { excludeSourceTypes: CLOSING_SOURCE_TYPES })
    ]);
    const pl = buildProfitLoss(period as AccountBalance[], isoDay(from), isoDay(to));
    return buildCashFlow(opening as AccountBalance[], closing as AccountBalance[], isoDay(from), isoDay(to), pl.netIncome);
  }
  if (type === "changes_in_equity") {
    const from = params.from ?? new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const to = params.to ?? new Date();
    const [opening, closing, period] = await Promise.all([
      loadAccountBalances(undefined, new Date(from.getTime() - 1)),
      loadAccountBalances(undefined, to),
      loadAccountBalances(from, to, { excludeSourceTypes: CLOSING_SOURCE_TYPES })
    ]);
    const pl = buildProfitLoss(period as AccountBalance[], isoDay(from), isoDay(to));
    return buildChangesInEquity(opening as AccountBalance[], closing as AccountBalance[], isoDay(from), isoDay(to), pl.netIncome);
  }
  if (type === "aging") {
    const asOf = params.asOf ?? new Date();
    return computeAging(asOf);
  }
  if (type === "payroll_liabilities") {
    return computePayrollLiabilities();
  }
  throw new Error(`Unsupported snapshot type ${type}`);
}

async function computeAging(asOf: Date) {
  const [invoices, bills] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { in: [TransactionStatus.open, TransactionStatus.partial] }, balance: { gt: 0 } },
      select: { id: true, number: true, dueDate: true, issueDate: true, balance: true, customer: { select: { displayName: true } } }
    }),
    prisma.bill.findMany({
      where: { status: { in: [TransactionStatus.open, TransactionStatus.partial] }, balance: { gt: 0 } },
      select: { id: true, number: true, dueDate: true, billDate: true, balance: true, supplier: { select: { displayName: true } } }
    })
  ]);
  const day = isoDay(asOf);
  const ar = buildAging(
    invoices.map((i) => ({ id: i.id, number: i.number, name: i.customer.displayName, dueDate: isoDay(i.dueDate ?? i.issueDate), balance: i.balance })),
    day
  );
  const ap = buildAging(
    bills.map((b) => ({ id: b.id, number: b.number, name: b.supplier.displayName, dueDate: isoDay(b.dueDate ?? b.billDate), balance: b.balance })),
    day
  );
  return { ar, ap };
}

async function computePayrollLiabilities() {
  const balances = await loadAccountBalances();
  const payrollCodes = ["2100", "2200", "2300", "2500", "2600"];
  const gl = balances
    .filter((b) => payrollCodes.includes(b.code))
    .map((b) => ({ code: b.code, name: b.name, glBalance: round2(-b.balance) }));
  const runs = await prisma.payRun.findMany({
    where: { status: { in: ["finalized", "exported", "paid"] }, statutoryRemittedAt: null },
    select: {
      id: true,
      status: true,
      period: { select: { label: true, payDate: true, endDate: true } },
      items: { select: { net: true, nhi: true, employerNhi: true, ssb: true, employerSsb: true, payrollTax: true, employerPayrollTax: true } }
    }
  });
  const openRuns = runs.map((r) => ({
    id: r.id,
    label: r.period.label,
    payDate: isoDay(r.period.payDate ?? r.period.endDate),
    status: r.status,
    nhi: round2(r.items.reduce((s, i) => s + i.nhi + i.employerNhi, 0)),
    ssb: round2(r.items.reduce((s, i) => s + i.ssb + i.employerSsb, 0)),
    payrollTax: round2(r.items.reduce((s, i) => s + i.payrollTax + i.employerPayrollTax, 0)),
    netWages: r.status === "paid" ? 0 : round2(r.items.reduce((s, i) => s + i.net, 0))
  }));
  return { asOf: isoDay(new Date()), gl, openRuns };
}

export const financeStatementRoutes = new Hono<{ Variables: AuthVariables }>()

  // ---------------------------------------------------------------------
  // Live statements (computed on demand)
  // ---------------------------------------------------------------------

  .get("/statements/profit-loss", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const from = parseDate(c.req.query("from"));
    const to = parseDate(c.req.query("to"));
    const payload = (await computeStatement(ReportSnapshotType.profit_loss, { from: from ?? undefined, to: to ?? undefined })) as ProfitLoss;
    let comparative: ProfitLoss | null = null;
    if (c.req.query("compare") === "1") {
      comparative = (await computeStatement(ReportSnapshotType.profit_loss, {
        from: shiftYear(payload.from ? parseDate(payload.from)! : new Date(), -1),
        to: shiftYear(parseDate(payload.to)!, -1)
      })) as ProfitLoss;
    }
    return c.json({ profitLoss: payload, comparative });
  })

  .get("/statements/balance-sheet", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const asOf = parseDate(c.req.query("asOf"));
    const payload = (await computeStatement(ReportSnapshotType.balance_sheet, { asOf: asOf ?? undefined })) as BalanceSheet;
    let comparative: BalanceSheet | null = null;
    if (c.req.query("compare") === "1") {
      comparative = (await computeStatement(ReportSnapshotType.balance_sheet, {
        asOf: shiftYear(parseDate(payload.asOf)!, -1)
      })) as BalanceSheet;
    }
    return c.json({ balanceSheet: payload, comparative });
  })

  .get("/statements/cash-flow", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const payload = await computeStatement(ReportSnapshotType.cash_flow, {
      from: parseDate(c.req.query("from")) ?? undefined,
      to: parseDate(c.req.query("to")) ?? undefined
    });
    return c.json({ cashFlow: payload });
  })

  .get("/statements/equity", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const payload = await computeStatement(ReportSnapshotType.changes_in_equity, {
      from: parseDate(c.req.query("from")) ?? undefined,
      to: parseDate(c.req.query("to")) ?? undefined
    });
    return c.json({ equity: payload });
  })

  .get("/statements/aging", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const asOf = parseDate(c.req.query("asOf")) ?? new Date();
    return c.json({ aging: await computeAging(asOf) });
  })

  .get("/statements/payroll-liabilities", authRequired, requireRole(...CAN_VIEW), async (c) => {
    return c.json({ payrollLiabilities: await computePayrollLiabilities() });
  })

  // ---------------------------------------------------------------------
  // Locked snapshots (immutable; exports render the stored payload)
  // ---------------------------------------------------------------------

  .get("/statements/snapshots", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const type = c.req.query("type");
    const items = await prisma.reportSnapshot.findMany({
      where: type ? { type: type as ReportSnapshotType } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, createdAt: true, type: true, label: true, paramsJson: true, hash: true, createdByUserId: true }
    });
    return c.json({ items });
  })

  .post("/statements/snapshots", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const type = String(body.type ?? "") as ReportSnapshotType;
    if (!Object.values(ReportSnapshotType).includes(type)) {
      return c.json({ error: `type must be one of ${Object.values(ReportSnapshotType).join(", ")}.` }, 400);
    }
    const params = {
      from: parseDate(body.from) ?? undefined,
      to: parseDate(body.to) ?? undefined,
      asOf: parseDate(body.asOf) ?? undefined
    };
    const payload = type === ReportSnapshotType.annual_return
      ? await computeAnnualReturn(Number(body.year ?? new Date().getUTCFullYear()))
      : await computeStatement(type, params);
    const snapshot = await prisma.reportSnapshot.create({
      data: {
        orgId: requireOrgId(),
        type,
        label: String(body.label ?? "").slice(0, 200),
        paramsJson: { ...params, year: body.year ?? null },
        payloadJson: payload as object,
        hash: statementHash(payload),
        createdByUserId: c.get("userId")
      }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "statement.snapshot_create",
      entityType: "ReportSnapshot",
      entityId: snapshot.id,
      after: { type, label: snapshot.label, hash: snapshot.hash }
    });
    return c.json({ snapshot }, 201);
  })

  .get("/statements/snapshots/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const snapshot = await prisma.reportSnapshot.findUnique({ where: { id: c.req.param("id") } });
    if (!snapshot) return c.json({ error: "Not found" }, 404);
    const intact = statementHash(snapshot.payloadJson) === snapshot.hash;
    return c.json({ snapshot, intact });
  })

  .get("/statements/snapshots/:id/export.csv", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const snapshot = await prisma.reportSnapshot.findUnique({ where: { id: c.req.param("id") } });
    if (!snapshot) return c.json({ error: "Not found" }, 404);
    const title = `${snapshot.type.replace(/_/g, " ")} — ${snapshot.label || snapshot.id}`;
    const csv = statementToCsv(title, flattenSnapshot(snapshot.type, snapshot.payloadJson));
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "statement.snapshot_export",
      entityType: "ReportSnapshot",
      entityId: snapshot.id,
      metadata: { format: "csv" }
    });
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${snapshot.type}-${snapshot.id}.csv"`
      }
    });
  })

  .get("/statements/snapshots/:id/export.pdf", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const snapshot = await prisma.reportSnapshot.findUnique({ where: { id: c.req.param("id") } });
    if (!snapshot) return c.json({ error: "Not found" }, 404);
    const title = `${snapshot.type.replace(/_/g, " ")} — ${snapshot.label || snapshot.id}`;
    const pdf = await renderSnapshotPdf(title, flattenSnapshot(snapshot.type, snapshot.payloadJson));
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "statement.snapshot_export",
      entityType: "ReportSnapshot",
      entityId: snapshot.id,
      metadata: { format: "pdf" }
    });
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${snapshot.type}-${snapshot.id}.pdf"`
      }
    });
  })

  // ---------------------------------------------------------------------
  // Year-end close: draft -> reviewed -> approved -> posted (signed),
  // corrections by superseding revision.
  // ---------------------------------------------------------------------

  .get("/year-end-closes", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const items = await prisma.yearEndClose.findMany({
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      take: 100
    });
    return c.json({ items });
  })

  .post("/year-end-closes", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return c.json({ error: "A valid year is required." }, 400);
    }
    const revisionOfId = body.revisionOfId ? String(body.revisionOfId) : null;

    const settings = await prisma.orgSettings.findFirst();
    const { to } = yearWindow(year, settings?.fiscalYearEndMonth ?? 12);
    const balances = await loadAccountBalances(undefined, to);
    const preview = buildYearEndClosingJournal({
      closeId: "preview",
      year,
      closeDate: to,
      retainedEarningsAccountId: "(resolved at posting)",
      balances
    });
    if (preview.lines.length === 0) {
      return c.json({ error: "Nothing to close — no revenue or expense balances at year end." }, 400);
    }

    const close = await prisma.yearEndClose.create({
      data: {
        orgId: requireOrgId(),
        year,
        closingPreviewJson: { lines: preview.lines, closeDate: isoDay(to) },
        revisionOfId,
        revisionReason: String(body.revisionReason ?? "").slice(0, 500),
        createdByUserId: c.get("userId")
      }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "year_end_close.create",
      entityType: "YearEndClose",
      entityId: close.id,
      after: { year, revisionOfId }
    });
    return c.json({ close }, 201);
  })

  .post("/year-end-closes/:id/review", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const close = await prisma.yearEndClose.findUnique({ where: { id: c.req.param("id") } });
    if (!close) return c.json({ error: "Not found" }, 404);
    if (close.status !== YearEndCloseStatus.draft) {
      return c.json({ error: "Only draft closes can be marked reviewed." }, 409);
    }
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
    const updated = await prisma.yearEndClose.update({
      where: { id: close.id },
      data: {
        status: YearEndCloseStatus.reviewed,
        reviewedByUserId: c.get("userId"),
        reviewedAt: new Date(),
        reviewNote: String((body as Record<string, unknown>).reviewNote ?? "").slice(0, 500)
      }
    });
    await writeAudit({ actorUserId: c.get("userId"), action: "year_end_close.review", entityType: "YearEndClose", entityId: close.id });
    return c.json({ close: updated });
  })

  .post("/year-end-closes/:id/approve", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const close = await prisma.yearEndClose.findUnique({ where: { id: c.req.param("id") } });
    if (!close) return c.json({ error: "Not found" }, 404);
    if (close.status !== YearEndCloseStatus.reviewed) {
      return c.json({ error: "A close must be reviewed before approval." }, 409);
    }
    const updated = await prisma.yearEndClose.update({
      where: { id: close.id },
      data: { status: YearEndCloseStatus.approved, approvedByUserId: c.get("userId"), approvedAt: new Date() }
    });
    await writeAudit({ actorUserId: c.get("userId"), action: "year_end_close.approve", entityType: "YearEndClose", entityId: close.id });
    return c.json({ close: updated });
  })

  .post("/year-end-closes/:id/post", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const close = await prisma.yearEndClose.findUnique({ where: { id: c.req.param("id") } });
    if (!close) return c.json({ error: "Not found" }, 404);
    if (close.status !== YearEndCloseStatus.approved) {
      return c.json({ error: "A close must be reviewed and approved before posting." }, 409);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const signatureText = String(body.signatureText ?? "").trim();
    if (signatureText.length < 3) {
      return c.json({ error: "signatureText is required — type the signer's full name." }, 400);
    }
    const existing = await prisma.yearEndClose.findFirst({
      where: { year: close.year, status: YearEndCloseStatus.posted, id: { not: close.revisionOfId ?? "" } },
      select: { id: true }
    });
    if (existing) {
      return c.json({ error: `Year ${close.year} already has a posted close. Revise it instead.` }, 409);
    }

    const settings = await prisma.orgSettings.findFirst();
    const { to } = yearWindow(close.year, settings?.fiscalYearEndMonth ?? 12);
    try {
      const result = await prisma.$transaction(async (tx) => {
        const accounts = await ensureControlAccounts(tx);
        // Revision: reverse the superseded close's journal FIRST (same tx) so
        // the fresh closing journal is computed from pre-close balances.
        let reversedJournalId: string | null = null;
        if (close.revisionOfId) {
          const prior = await tx.yearEndClose.findUnique({ where: { id: close.revisionOfId } });
          if (prior?.closingJournalEntryId) {
            const rev = await reverseJournal(tx, "year_end_close", close.revisionOfId, {
              date: new Date(),
              memo: `Reversal of year-end close ${close.year} (superseded by revision)`,
              createdByUserId: c.get("userId")
            });
            reversedJournalId = rev?.entryId ?? null;
          }
          await tx.yearEndClose.update({
            where: { id: close.revisionOfId },
            data: { status: YearEndCloseStatus.superseded, supersededById: close.id }
          });
        }
        // Fresh balances at posting time — read inside the tx so the reversal
        // above is visible; the preview may be stale.
        const balances = await loadAccountBalances(undefined, to, { client: tx });
        const journal = buildYearEndClosingJournal({
          closeId: close.id,
          year: close.year,
          closeDate: to,
          retainedEarningsAccountId: accounts.retainedEarnings,
          balances
        });
        if (journal.lines.length === 0) {
          throw new Error("Nothing to close — no revenue or expense balances at year end.");
        }
        const posted = await postJournal(tx, journal, c.get("userId"));
        const updated = await tx.yearEndClose.update({
          where: { id: close.id },
          data: {
            status: YearEndCloseStatus.posted,
            postedAt: new Date(),
            postedByUserId: c.get("userId"),
            signatureText,
            closingJournalEntryId: posted.entryId,
            closingPreviewJson: { lines: journal.lines, closeDate: isoDay(to), reversedJournalId }
          }
        });
        return updated;
      });
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "year_end_close.post",
        entityType: "YearEndClose",
        entityId: close.id,
        after: { year: close.year, signatureText, journalEntryId: result.closingJournalEntryId }
      });
      return c.json({ close: result });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not post the close.";
      const status = message.includes("fiscal period") ? 409 : 400;
      return c.json({ error: message }, status);
    }
  })

  .post("/year-end-closes/:id/revise", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const close = await prisma.yearEndClose.findUnique({ where: { id: c.req.param("id") } });
    if (!close) return c.json({ error: "Not found" }, 404);
    if (close.status !== YearEndCloseStatus.posted) {
      return c.json({ error: "Only a posted close can be revised." }, 409);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const reason = String(body.reason ?? "").trim();
    if (!reason) return c.json({ error: "A revision reason is required (audit)." }, 400);

    const settings = await prisma.orgSettings.findFirst();
    const { to } = yearWindow(close.year, settings?.fiscalYearEndMonth ?? 12);
    // Preview must show the balances the revision will close: raw balances
    // with the prior closing journal's effect undone (it is only reversed at
    // posting time, inside the posting transaction).
    const balances = await loadAccountBalances(undefined, to);
    const priorLines = (close.closingPreviewJson as { lines?: Array<{ accountId?: string; debit?: number; credit?: number }> } | null)?.lines ?? [];
    const priorEffect = new Map<string, number>();
    for (const l of priorLines) {
      if (!l.accountId) continue;
      priorEffect.set(l.accountId, round2((priorEffect.get(l.accountId) ?? 0) + Number(l.debit ?? 0) - Number(l.credit ?? 0)));
    }
    const asIfReversed = balances.map((b) => ({ ...b, balance: round2(b.balance - (priorEffect.get(b.accountId) ?? 0)) }));
    const preview = buildYearEndClosingJournal({
      closeId: "preview",
      year: close.year,
      closeDate: to,
      retainedEarningsAccountId: "(resolved at posting)",
      balances: asIfReversed
    });
    const revision = await prisma.yearEndClose.create({
      data: {
        orgId: requireOrgId(),
        year: close.year,
        closingPreviewJson: { lines: preview.lines, closeDate: isoDay(to), note: "Computed after reversal of the prior close" },
        revisionOfId: close.id,
        revisionReason: reason,
        createdByUserId: c.get("userId")
      }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "year_end_close.revise",
      entityType: "YearEndClose",
      entityId: revision.id,
      after: { revisionOfId: close.id, reason }
    });
    return c.json({ close: revision }, 201);
  })

  // ---------------------------------------------------------------------
  // BVI filing support (annual return mapping + applicability).
  // Filing support only — nothing here files anything.
  // ---------------------------------------------------------------------

  .get("/filing/annual-return", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const year = Number(c.req.query("year") ?? new Date().getUTCFullYear());
    return c.json({ annualReturn: await computeAnnualReturn(year) });
  });

async function computeAnnualReturn(year: number) {
  const settings = await prisma.orgSettings.findFirst();
  const fyeMonth = settings?.fiscalYearEndMonth ?? 12;
  const { from, to } = yearWindow(year, fyeMonth);

  const [closingBalances, periodBalances] = await Promise.all([
    loadAccountBalances(undefined, to),
    // Operating P&L for the year must exclude year-end closing journals —
    // after a close, raw balances net revenue/expenses to zero inside the window.
    loadAccountBalances(from, to, { excludeSourceTypes: CLOSING_SOURCE_TYPES })
  ]);
  const bs = buildBalanceSheet(closingBalances as AccountBalance[], isoDay(to));
  const pl = buildProfitLoss(periodBalances as AccountBalance[], isoDay(from), isoDay(to));

  const employeeCount = await prisma.employee.count({ where: { active: true } });
  const runs = await prisma.payRun.findMany({
    where: { status: { in: ["finalized", "exported", "paid"] }, period: { payDate: { gte: from, lte: to } } },
    select: { items: { select: { gross: true, net: true, employerNhi: true, employerSsb: true, employerPayrollTax: true, nhi: true, ssb: true, payrollTax: true } } }
  });
  const payroll = {
    runCount: runs.length,
    gross: round2(runs.flatMap((r) => r.items).reduce((s, i) => s + i.gross, 0)),
    net: round2(runs.flatMap((r) => r.items).reduce((s, i) => s + i.net, 0)),
    nhi: round2(runs.flatMap((r) => r.items).reduce((s, i) => s + i.nhi + i.employerNhi, 0)),
    ssb: round2(runs.flatMap((r) => r.items).reduce((s, i) => s + i.ssb + i.employerSsb, 0)),
    payrollTax: round2(runs.flatMap((r) => r.items).reduce((s, i) => s + i.payrollTax + i.employerPayrollTax, 0))
  };

  const fye = isoDay(to);
  const annualReturnDeadline = isoDay(new Date(Date.UTC(year, fyeMonth + 9 - 1 + 1, 0))); // FYE + 9 months
  const irDeadline = isoDay(new Date(Date.UTC(year, fyeMonth + 3 - 1 + 1, 0))); // FYE + 90 days (approx)

  return {
    year,
    financialYearEnd: fye,
    wording: "Filing support only — this is a data mapping, not a filed return, and no electronic submission exists.",
    identity: {
      companyLegalName: settings?.companyLegalName ?? "",
      companyRegistrationNumber: settings?.companyRegistrationNumber ?? "",
      incorporationDate: settings?.incorporationDate ? isoDay(settings.incorporationDate) : null,
      registeredAgentName: settings?.registeredAgentName ?? "",
      registeredOfficeAddress: settings?.registeredOfficeAddress ?? ""
    },
    applicability: {
      hasRegisteredAgent: Boolean(settings?.registeredAgentName),
      filesIrFinancialStatements: Boolean(settings?.filesIrFinancialStatements),
      annualReturnExemptionBasis: settings?.annualReturnExemptionBasis ?? "",
      note: "Under the BVI Business Companies (Financial Return) Order 2023 the annual return is generally filed with the registered agent within 9 months after financial year-end, subject to statutory exemptions (e.g. companies that file a tax return with financial statements with Inland Revenue). Confirm which obligation applies before relying on this mapping."
    },
    mapping: {
      totalAssets: bs.totalAssets,
      totalLiabilities: bs.totalLiabilities,
      netAssets: round2(bs.totalAssets - bs.totalLiabilities),
      totalRevenue: pl.totalRevenue,
      totalExpenses: pl.totalExpenses,
      netIncome: pl.netIncome,
      balanceCheck: bs.balanceCheck
    },
    payrollSupport: { employeeCount, ...payroll },
    deadlines: {
      annualReturnWithRegisteredAgent: annualReturnDeadline,
      inlandRevenueReturnApprox: irDeadline
    },
    sources: [
      "BVI Business Companies (Financial Return) Order 2023 (bvifsc.vg)",
      "BVIFSC Industry Circular 26/2025",
      "Inland Revenue return deadline: verify against current IR guidance before relying on it"
    ]
  };
}
