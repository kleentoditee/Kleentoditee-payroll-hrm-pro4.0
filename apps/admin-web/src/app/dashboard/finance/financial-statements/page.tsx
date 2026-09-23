"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useState } from "react";

type Section = { subtype: string; accounts: Array<{ accountId: string; code: string; name: string; amount: number }>; total: number };

type ProfitLoss = {
  from: string;
  to: string;
  revenueSections: Section[];
  expenseSections: Section[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
};

type BalanceSheet = {
  asOf: string;
  assetSections: Section[];
  liabilitySections: Section[];
  equityAccounts: Array<{ accountId: string; code: string; name: string; amount: number }>;
  currentEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  balanceCheck: number;
  cashAndEquivalents: number;
};

type CashFlow = {
  from: string;
  to: string;
  operating: { label: string; lines: Array<{ name: string; change: number }>; total: number };
  investing: { label: string; lines: Array<{ name: string; change: number }>; total: number };
  financing: { label: string; lines: Array<{ name: string; change: number }>; total: number };
  netChangeInCash: number;
  openingCash: number;
  closingCash: number;
  completenessCheck: number;
};

type EquityStatement = {
  from: string;
  to: string;
  openingEquity: number;
  netIncome: number;
  ownerContributions: number;
  ownerDraws: number;
  closingEquity: number;
  consistencyCheck: number;
};

type SnapshotMeta = { id: string; createdAt: string; type: string; label: string; hash: string };

type Tab = "profit_loss" | "balance_sheet" | "cash_flow" | "changes_in_equity";

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TABS: Array<{ key: Tab; label: string; path: string }> = [
  { key: "profit_loss", label: "Profit & loss", path: "profit-loss" },
  { key: "balance_sheet", label: "Balance sheet", path: "balance-sheet" },
  { key: "cash_flow", label: "Cash flow", path: "cash-flow" },
  { key: "changes_in_equity", label: "Changes in equity", path: "equity" }
];

function SectionBlock({ title, sections }: { title: string; sections: Section[] }) {
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold text-slate-900">{title}</h4>
      {sections.map((s) => (
        <div key={s.subtype} className="mb-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.subtype}</p>
          {s.accounts.map((a) => (
            <div key={a.accountId} className="flex justify-between py-0.5 text-sm">
              <span className="pl-3 text-slate-700">{a.code} {a.name}</span>
              <span className="tabular-nums">${money(a.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-100 py-0.5 text-sm font-medium">
            <span className="pl-3">Total {s.subtype}</span>
            <span className="tabular-nums">${money(s.total)}</span>
          </div>
        </div>
      ))}
      {sections.length === 0 ? <p className="text-sm text-slate-400">No activity.</p> : null}
    </div>
  );
}

export default function FinancialStatementsPage() {
  const [tab, setTab] = useState<Tab>("profit_loss");
  const [from, setFrom] = useState(`${new Date().getUTCFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [compare, setCompare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [pl, setPl] = useState<ProfitLoss | null>(null);
  const [plComp, setPlComp] = useState<ProfitLoss | null>(null);
  const [bs, setBs] = useState<BalanceSheet | null>(null);
  const [bsComp, setBsComp] = useState<BalanceSheet | null>(null);
  const [cf, setCf] = useState<CashFlow | null>(null);
  const [eq, setEq] = useState<EquityStatement | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const t = TABS.find((x) => x.key === tab)!;
      const params = new URLSearchParams();
      if (tab === "balance_sheet") {
        params.set("asOf", asOf);
      } else {
        params.set("from", from);
        params.set("to", to);
      }
      if (compare && (tab === "profit_loss" || tab === "balance_sheet")) params.set("compare", "1");
      const res = await fetch(`${apiBase()}/finance/statements/${t.path}?${params}`, { headers: { ...authHeaders() } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load statement");
      setPl(json.profitLoss ?? null);
      setPlComp(json.comparative ?? null);
      setBs(json.balanceSheet ?? null);
      setBsComp(json.comparative ?? null);
      setCf(json.cashFlow ?? null);
      setEq(json.equity ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load statement");
    }
  }, [tab, from, to, asOf, compare]);

  const loadSnapshots = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/finance/statements/snapshots?type=${tab}`, { headers: { ...authHeaders() } });
      const json = await readApiData<{ items: SnapshotMeta[] }>(res);
      setSnapshots(json.items);
    } catch {
      // non-fatal
    }
  }, [tab]);

  useEffect(() => {
    void load();
    void loadSnapshots();
  }, [load, loadSnapshots]);

  async function saveSnapshot() {
    setError(null);
    try {
      const body: Record<string, unknown> = { type: tab, label: `${TABS.find((t) => t.key === tab)!.label} ${tab === "balance_sheet" ? asOf : `${from} to ${to}`}` };
      if (tab === "balance_sheet") body.asOf = asOf;
      else {
        body.from = from;
        body.to = to;
      }
      const res = await fetch(`${apiBase()}/finance/statements/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body)
      });
      const json = await readApiData<{ snapshot: SnapshotMeta }>(res);
      setNotice(`Snapshot locked (${json.snapshot.hash.slice(0, 12)}…). Exports reproduce exactly this.`);
      await loadSnapshots();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save snapshot");
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Financial statements</h2>
        <p className="text-sm text-slate-600">
          Derived from the general ledger. Save a snapshot to lock a reproducible copy; CSV/PDF exports render the
          locked snapshot, never a recompute.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t.key ? "bg-brand text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {tab === "balance_sheet" ? (
          <label className="text-sm font-medium text-slate-700">
            As of
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" />
          </label>
        ) : (
          <>
            <label className="text-sm font-medium text-slate-700">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" />
            </label>
          </>
        )}
        {(tab === "profit_loss" || tab === "balance_sheet") && (
          <label className="flex items-center gap-1.5 text-sm text-slate-700">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="h-4 w-4" />
            Prior-year comparative
          </label>
        )}
        <button type="button" onClick={() => void saveSnapshot()} className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white">
          Lock snapshot
        </button>
      </div>

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {tab === "profit_loss" && pl ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">{pl.from} to {pl.to}</p>
            <SectionBlock title="Revenue" sections={pl.revenueSections} />
            <div className="flex justify-between border-t border-slate-200 py-1 text-sm font-semibold">
              <span>Total revenue</span>
              <span className="tabular-nums">${money(pl.totalRevenue)}{plComp ? ` (prior $${money(plComp.totalRevenue)})` : ""}</span>
            </div>
            <SectionBlock title="Expenses" sections={pl.expenseSections} />
            <div className="flex justify-between border-t border-slate-200 py-1 text-sm font-semibold">
              <span>Total expenses</span>
              <span className="tabular-nums">${money(pl.totalExpenses)}{plComp ? ` (prior $${money(plComp.totalExpenses)})` : ""}</span>
            </div>
            <div className={`flex justify-between rounded-md px-3 py-2 text-sm font-semibold ${pl.netIncome >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
              <span>Net income</span>
              <span className="tabular-nums">${money(pl.netIncome)}{plComp ? ` (prior $${money(plComp.netIncome)})` : ""}</span>
            </div>
          </div>
        ) : null}

        {tab === "balance_sheet" && bs ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">As of {bs.asOf}</p>
            <p className={`rounded-md px-3 py-2 text-sm font-medium ${bs.balanceCheck === 0 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
              {bs.balanceCheck === 0 ? "A = L + E — balanced." : `OUT OF BALANCE by $${money(bs.balanceCheck)}.`}
            </p>
            <SectionBlock title="Assets" sections={bs.assetSections} />
            <div className="flex justify-between border-t border-slate-200 py-1 text-sm font-semibold">
              <span>Total assets</span>
              <span className="tabular-nums">${money(bs.totalAssets)}{bsComp ? ` (prior $${money(bsComp.totalAssets)})` : ""}</span>
            </div>
            <SectionBlock title="Liabilities" sections={bs.liabilitySections} />
            <div className="flex justify-between border-t border-slate-200 py-1 text-sm font-semibold">
              <span>Total liabilities</span>
              <span className="tabular-nums">${money(bs.totalLiabilities)}</span>
            </div>
            <div>
              <h4 className="mb-1 text-sm font-semibold text-slate-900">Equity</h4>
              {bs.equityAccounts.map((a) => (
                <div key={a.accountId} className="flex justify-between py-0.5 text-sm">
                  <span className="pl-3 text-slate-700">{a.code} {a.name}</span>
                  <span className="tabular-nums">${money(a.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between py-0.5 text-sm">
                <span className="pl-3 text-slate-700">Current earnings</span>
                <span className="tabular-nums">${money(bs.currentEarnings)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 py-1 text-sm font-semibold">
                <span>Total equity</span>
                <span className="tabular-nums">${money(bs.totalEquity)}</span>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "cash_flow" && cf ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">{cf.from} to {cf.to}</p>
            {cf.completenessCheck !== 0 ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Unclassified movement of ${money(cf.completenessCheck)} — a new account subtype needs classification.
              </p>
            ) : null}
            {[cf.operating, cf.investing, cf.financing].map((section) => (
              <div key={section.label}>
                <h4 className="mb-1 text-sm font-semibold text-slate-900">{section.label}</h4>
                {section.lines.map((l, i) => (
                  <div key={i} className="flex justify-between py-0.5 text-sm">
                    <span className="pl-3 text-slate-700">{l.name}</span>
                    <span className="tabular-nums">${money(l.change)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-slate-100 py-0.5 text-sm font-medium">
                  <span className="pl-3">Net {section.label.toLowerCase()}</span>
                  <span className="tabular-nums">${money(section.total)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 py-1 text-sm font-semibold">
              <span>Net change in cash</span>
              <span className="tabular-nums">${money(cf.netChangeInCash)}</span>
            </div>
            <div className="flex justify-between py-0.5 text-sm">
              <span>Opening cash</span>
              <span className="tabular-nums">${money(cf.openingCash)}</span>
            </div>
            <div className="flex justify-between py-0.5 text-sm font-semibold">
              <span>Closing cash (agrees with bank registers)</span>
              <span className="tabular-nums">${money(cf.closingCash)}</span>
            </div>
          </div>
        ) : null}

        {tab === "changes_in_equity" && eq ? (
          <div className="space-y-1">
            <p className="text-xs text-slate-500">{eq.from} to {eq.to}</p>
            {[
              ["Opening equity", eq.openingEquity],
              ["Net income", eq.netIncome],
              ["Owner contributions", eq.ownerContributions],
              ["Owner draws", -eq.ownerDraws],
              ["Closing equity", eq.closingEquity]
            ].map(([label, value], i) => (
              <div key={label as string} className={`flex justify-between py-1 text-sm ${i === 4 ? "border-t border-slate-200 font-semibold" : ""}`}>
                <span>{label}</span>
                <span className="tabular-nums">${money(value as number)}</span>
              </div>
            ))}
            {eq.consistencyCheck !== 0 ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Consistency check off by ${money(eq.consistencyCheck)}.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">Locked snapshots</h3>
        {snapshots.length === 0 ? <p className="text-sm text-slate-500">None yet for this statement type.</p> : null}
        {snapshots.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <div>
              <p className="font-medium text-slate-900">{s.label || s.type}</p>
              <p className="text-xs text-slate-500">{s.createdAt.slice(0, 16).replace("T", " ")} · hash {s.hash.slice(0, 12)}…</p>
            </div>
            <div className="flex gap-2 text-xs">
              <a href={`${apiBase()}/finance/statements/snapshots/${s.id}/export.csv`} className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200">CSV</a>
              <a href={`${apiBase()}/finance/statements/snapshots/${s.id}/export.pdf`} className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200">PDF</a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
