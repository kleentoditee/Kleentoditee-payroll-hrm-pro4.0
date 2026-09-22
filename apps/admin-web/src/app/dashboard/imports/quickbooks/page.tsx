"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useMemo, useRef, useState } from "react";

type ImportType =
  | "customers"
  | "vendors"
  | "accounts"
  | "products"
  | "invoices"
  | "bills"
  | "expenses"
  | "payments"
  | "deposits";

type RowError = { rowNumber: number; message: string };
type Plan = {
  importType: ImportType;
  headers: string[];
  mappings: Record<string, string>;
  previewRows: Record<string, string>[];
  rowCount: number;
  validationErrors: RowError[];
  validationErrorCount?: number;
  warnings?: string[];
};
type Result = {
  importType: ImportType;
  created: number;
  skipped: number;
  skippedEmptyRows?: number;
  duplicates: number;
  validationErrors: RowError[];
  validationErrorCount?: number;
};

const importCards: Array<{ id: ImportType; title: string; detail: string; fields: string[] }> = [
  { id: "customers", title: "Customers", detail: "Names, contacts, billing addresses, and opening balances.", fields: ["displayName", "companyName", "email", "phone", "billingAddress", "shippingAddress"] },
  { id: "vendors", title: "Vendors", detail: "Supplier names, companies, contact details, and addresses.", fields: ["displayName", "companyName", "email", "phone", "mailingAddress"] },
  { id: "accounts", title: "Chart of Accounts", detail: "Account names, numbers, types, detail types, and balances.", fields: ["name", "type", "subtype", "code"] },
  { id: "products", title: "Products & Services", detail: "Items, services, SKUs, rates, descriptions, and income accounts.", fields: ["name", "sku", "kind", "description", "salesPrice", "incomeAccountName"] },
  { id: "invoices", title: "Invoices", detail: "Invoice numbers, customers, dates, line labels, totals, and status.", fields: ["number", "customerName", "issueDate", "dueDate", "lineItemName", "total", "balance", "status"] },
  { id: "bills", title: "Bills", detail: "Vendor bills, bill dates, due dates, totals, balances, and status.", fields: ["number", "supplierName", "billDate", "dueDate", "total", "balance", "status"] },
  { id: "expenses", title: "Expenses", detail: "Paid expenses, payees, payment accounts, categories, amounts, and memos.", fields: ["expenseDate", "payeeName", "paymentAccountName", "categoryName", "amount", "memo"] },
  { id: "payments", title: "Payments Received", detail: "Customer payments, methods, references, amounts, and deposit accounts.", fields: ["paymentDate", "customerName", "method", "reference", "amount", "depositAccountName"] },
  { id: "deposits", title: "Deposits", detail: "Deposit dates, bank accounts, received-from notes, memos, and amounts.", fields: ["depositDate", "accountName", "receivedFrom", "memo", "amount"] }
];

const steps = ["Upload", "Map columns", "Preview", "Validate", "Import complete"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ".xlsx,.csv";
const fieldLabels: Record<string, string> = {
  displayName: "Display name",
  companyName: "Company name",
  email: "Email",
  phone: "Phone",
  billingAddress: "Billing address",
  shippingAddress: "Shipping address",
  mailingAddress: "Mailing address",
  openingBalance: "Opening balance",
  name: "Name",
  type: "Type",
  subtype: "Detail type",
  code: "Account number",
  sku: "SKU",
  kind: "Kind",
  description: "Description",
  salesPrice: "Sales price",
  incomeAccountName: "Income account",
  number: "Number",
  customerName: "Customer name",
  supplierName: "Supplier name",
  issueDate: "Invoice date",
  billDate: "Bill date",
  expenseDate: "Expense date",
  paymentDate: "Payment date",
  depositDate: "Deposit date",
  dueDate: "Due date",
  lineItemName: "Line item",
  total: "Total",
  balance: "Balance",
  status: "Status",
  payeeName: "Payee name",
  paymentAccountName: "Payment account",
  categoryName: "Category",
  amount: "Amount",
  memo: "Memo",
  method: "Payment method",
  reference: "Reference",
  depositAccountName: "Deposit account",
  accountName: "Account name",
  receivedFrom: "Received from"
};

export default function QuickBooksAccountingImportPage() {
  const [importType, setImportType] = useState<ImportType>("customers");
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [isCsv, setIsCsv] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const previewSeq = useRef(0);

  const selected = importCards.find((card) => card.id === importType) ?? importCards[0];
  const activeStep = result ? 4 : plan?.validationErrors.length ? 3 : plan ? 2 : fileContent ? 1 : 0;
  const mappedFields = useMemo(() => new Set(Object.values(plan?.mappings ?? {})), [plan]);
  const displayNameSource = useMemo(
    () => Object.entries(plan?.mappings ?? {}).find(([, field]) => field === "displayName")?.[0] ?? "",
    [plan]
  );

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    setResult(null);
    setPlan(null);
    setFileContent("");
    setIsCsv(false);
    setFileName("");
    if (!file) return;
    const lower = file.name.toLowerCase();
    const csvFile = lower.endsWith(".csv");
    const excelFile = lower.endsWith(".xlsx");
    if (!csvFile && !excelFile) {
      setError("Only .xlsx or .csv accounting export files are accepted.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Accounting export file is too large. Maximum size is 5 MB.");
      return;
    }
    setFileName(file.name);
    setIsCsv(csvFile);
    setFileContent(csvFile ? await file.text() : await readFileAsBase64(file));
  }

  async function preview(nextMappings?: Record<string, string>) {
    if (!fileContent || !fileName) {
      setError("Choose an Excel or CSV accounting export file first.");
      return;
    }
    const seq = ++previewSeq.current;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${apiBase()}/imports/quickbooks/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          importType,
          fileName,
          ...(isCsv ? { csv: fileContent } : { fileContent, encoding: "base64" }),
          mappings: nextMappings ?? plan?.mappings
        })
      });
      const data = await readApiData<{ plan: Plan }>(res);
      if (seq !== previewSeq.current) return; // a newer preview superseded this one
      setPlan(data.plan);
    } catch (e) {
      if (seq === previewSeq.current) setError(e instanceof Error ? e.message : "Could not preview this accounting export file.");
    } finally {
      if (seq === previewSeq.current) setBusy(false);
    }
  }

  async function commit() {
    if (!plan || !fileContent || !fileName) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/imports/quickbooks/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          importType,
          fileName,
          ...(isCsv ? { csv: fileContent } : { fileContent, encoding: "base64" }),
          mappings: plan.mappings
        })
      });
      const data = await readApiData<{ result: Result }>(res);
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import this accounting export file.");
    } finally {
      setBusy(false);
    }
  }

  function updateMapping(header: string, field: string) {
    if (!plan) return;
    const next = { ...plan.mappings };
    if (field === "displayName") {
      for (const [mappedHeader, mappedField] of Object.entries(next)) {
        if (mappedHeader !== header && mappedField === "displayName") delete next[mappedHeader];
      }
    }
    if (field) next[header] = field;
    else delete next[header];
    setPlan({ ...plan, mappings: next });
    void preview(next);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#006D77]">Accounting import center</p>
            <h2 className="mt-2 font-serif text-3xl text-slate-950">Accounting Import</h2>
          </div>
          <div className="rounded-2xl border border-[#006D77]/20 bg-[#EAF6F7] px-4 py-3 text-sm font-semibold text-[#063E4A]">
            File import only. KleenToDiTee does not connect to or sync with any outside accounting platform.
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          This quick import is not approved for full system migrations — it does not post journals, apply payments,
          or preserve opening balances. Use the{" "}
          <a href="/dashboard/imports/migration" className="underline">Migration center</a>{" "}
          for any legacy-system move (batched, validated, atomic, and reversible).
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-5">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
              index <= activeStep ? "border-[#006D77]/25 bg-[#EAF6F7] text-[#063E4A]" : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs shadow-sm">{index + 1}</span>
            {step}
          </div>
        ))}
      </div>

      <section className="grid gap-3 lg:grid-cols-3">
        {importCards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => {
              setImportType(card.id);
              setPlan(null);
              setResult(null);
            }}
            className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              importType === card.id ? "border-[#006D77]/35 bg-[#EAF6F7]" : "border-slate-200 bg-white"
            }`}
          >
            <p className="font-bold text-slate-950">{card.title}</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">{card.detail}</p>
          </button>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4 rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-950">Upload accounting export file</h3>
          </div>
          <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <span className="block text-sm font-bold text-slate-800">{fileName || `Choose ${selected.title} file`}</span>
            <span className="mt-1 block text-xs text-slate-500">XLSX or CSV, up to 5 MB. Files are parsed for this import and are not permanently stored.</span>
            <input type="file" accept={ACCEPTED_EXTENSIONS} className="sr-only" onChange={onFileChange} />
          </label>
          <button
            type="button"
            onClick={() => preview()}
            disabled={!fileContent || busy}
            className="w-full rounded-2xl bg-[#063E4A] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#006D77] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Working..." : "Preview and suggest mappings"}
          </button>
          {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        </div>

        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">File column to KleenToDiTee field</h3>
          {plan && selected.fields.includes("displayName") ? (
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Required Display name source: {displayNameSource || "not selected"}
            </p>
          ) : null}
          {!plan ? (
            <div className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
              Select an import type and upload an Excel or CSV accounting export. The app will suggest mappings for common accounting column names, then you can adjust them before importing.
            </div>
          ) : (
            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
              {plan.headers.map((header) => (
                <label key={header} className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm sm:grid-cols-[1fr_1fr] sm:items-center">
                  <span className="font-semibold text-slate-700">{header}</span>
                  <select
                    value={plan.mappings[header] ?? ""}
                    onChange={(e) => updateMapping(header, e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
                  >
                    <option value="">Do not import</option>
                    {selected.fields.map((field) => (
                      <option key={field} value={field} disabled={field === "displayName" && Boolean(displayNameSource) && displayNameSource !== header}>
                        {fieldLabels[field] ?? field}
                      </option>
                    ))}
                  </select>
                  {plan.mappings[header] === "displayName" ? (
                    <span className="text-xs font-semibold text-[#006D77]">This column satisfies required Display name.</span>
                  ) : null}
                </label>
              ))}
            </div>
          )}
        </div>
      </section>

      {plan ? (
        <section className="space-y-4 rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-950">Preview and validation</h3>
              <p className="text-sm text-slate-600">
                Showing {plan.previewRows.length} of {plan.rowCount} rows. {mappedFields.size} fields mapped.
              </p>
            </div>
            <button
              type="button"
              onClick={commit}
              disabled={busy || plan.validationErrors.length > 0}
              className="rounded-2xl bg-[#006D77] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#063E4A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirm import
            </button>
          </div>

          {plan.validationErrors.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-bold text-amber-900">Fix these rows before importing</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {plan.validationErrors.slice(0, 10).map((err) => (
                  <li key={`${err.rowNumber}-${err.message}`}>
                    {err.rowNumber > 0 ? `Row ${err.rowNumber}: ` : ""}{err.message}
                  </li>
                ))}
              </ul>
              {(plan.validationErrorCount ?? plan.validationErrors.length) > plan.validationErrors.length ? (
                <p className="mt-2 text-sm font-semibold text-amber-900">
                  and {(plan.validationErrorCount ?? 0) - plan.validationErrors.length} more rows need fixing.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
              Validation passed. Duplicates will be skipped safely during import.
            </p>
          )}

          {plan.warnings?.length ? (
            <div className="space-y-1 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-900">
              {plan.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>{plan.headers.slice(0, 8).map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plan.previewRows.map((row, index) => (
                  <tr key={index}>
                    {plan.headers.slice(0, 8).map((header) => (
                      <td key={header} className="max-w-56 truncate px-3 py-2 text-slate-700">{row[header] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {result ? (
        <section className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h3 className="text-lg font-bold text-emerald-950">Import complete</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ResultCard label="Created" value={result.created} />
            <ResultCard label="Skipped duplicates" value={result.duplicates} />
            <ResultCard label="Skipped empty rows" value={result.skippedEmptyRows ?? result.skipped} />
            <ResultCard label="Errors" value={result.validationErrorCount ?? result.validationErrors.length} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.split(",").pop() ?? "" : value);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function ResultCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white px-4 py-3 shadow-sm">
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
    </div>
  );
}
