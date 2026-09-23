export type PaystubPayload = {
  company?: { legalName?: string; address?: string } | null;
  employeeName: string;
  employeeRole: string;
  site: string;
  templateName: string;
  periodLabel: string;
  schedule: string;
  startDate: string;
  endDate: string;
  payDate: string | null;
  earnings: { gross: number; bonus: number; allowance: number; flatGross: number };
  deductions: {
    nhi: number;
    ssb: number;
    incomeTax: number;
    payrollTax: number;
    manual: number;
    advance: number;
    withdrawal: number;
    loan: number;
    other: number;
    total: number;
  };
  totals: { daysWorked: number; hoursWorked: number; overtimeHours: number; net: number };
  sources?: Array<{
    entryId: string;
    periodStart: string | null;
    site: string;
    startTime?: string;
    endTime?: string;
    breakMinutes?: number;
    hoursWorked: number;
  }>;
};

function formatMoney(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export function PaystubDocument({
  payload,
  stubNumber,
  issuedDate,
  preview = false
}: {
  payload: PaystubPayload;
  stubNumber: string;
  issuedDate: string;
  preview?: boolean;
}) {
  return (
    <article className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm print:shadow-none sm:p-8">
      {preview ? (
        <div className="mb-6 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Preview only - no pay run or paystub has been created.
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {payload.company?.legalName || "KleenToDiTee"}
          </p>
          {payload.company?.address ? (
            <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{payload.company.address}</p>
          ) : null}
          <h2 className="mt-1 font-serif text-3xl text-slate-900">Paystub</h2>
          <p className="mt-2 text-sm text-slate-600">{stubNumber}</p>
        </div>
        <div className="text-sm text-slate-600">
          <p>Issued: {issuedDate}</p>
          <p>Pay date: {payload.payDate ?? "-"}</p>
          <p>{payload.periodLabel}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Employee</h3>
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{payload.employeeName}</p>
            <p>{payload.employeeRole || "-"}</p>
            <p>{payload.site || "-"}</p>
            <p>Template: {payload.templateName}</p>
            <p>Schedule: {payload.schedule}</p>
          </div>
        </section>
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Period</h3>
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p>{payload.startDate} to {payload.endDate}</p>
            <p>Days: {payload.totals.daysWorked}</p>
            <p>Hours: {payload.totals.hoursWorked}</p>
            <p>OT hours: {payload.totals.overtimeHours}</p>
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg bg-slate-50 p-5">
          <h3 className="font-semibold text-slate-900">Earnings</h3>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between"><dt>Gross</dt><dd>{formatMoney(payload.earnings.gross)}</dd></div>
            <div className="flex items-center justify-between"><dt>Bonus</dt><dd>{formatMoney(payload.earnings.bonus)}</dd></div>
            <div className="flex items-center justify-between"><dt>Allowance</dt><dd>{formatMoney(payload.earnings.allowance)}</dd></div>
            <div className="flex items-center justify-between"><dt>Flat gross override</dt><dd>{formatMoney(payload.earnings.flatGross)}</dd></div>
          </dl>
        </section>
        <section className="rounded-lg bg-slate-50 p-5">
          <h3 className="font-semibold text-slate-900">Deductions</h3>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between"><dt>NHI</dt><dd>{formatMoney(payload.deductions.nhi)}</dd></div>
            <div className="flex items-center justify-between"><dt>SSB</dt><dd>{formatMoney(payload.deductions.ssb)}</dd></div>
            <div className="flex items-center justify-between"><dt>Payroll tax</dt><dd>{formatMoney(payload.deductions.payrollTax)}</dd></div>
            {payload.deductions.incomeTax ? <div className="flex items-center justify-between"><dt>Income tax</dt><dd>{formatMoney(payload.deductions.incomeTax)}</dd></div> : null}
            <div className="flex items-center justify-between"><dt>Manual deductions</dt><dd>{formatMoney(payload.deductions.manual)}</dd></div>
            {payload.deductions.advance ? <div className="flex items-center justify-between"><dt>Advance repayment</dt><dd>{formatMoney(payload.deductions.advance)}</dd></div> : null}
            {payload.deductions.withdrawal ? <div className="flex items-center justify-between"><dt>Withdrawal</dt><dd>{formatMoney(payload.deductions.withdrawal)}</dd></div> : null}
            {payload.deductions.loan ? <div className="flex items-center justify-between"><dt>Loan repayment</dt><dd>{formatMoney(payload.deductions.loan)}</dd></div> : null}
            {payload.deductions.other ? <div className="flex items-center justify-between"><dt>Other deductions</dt><dd>{formatMoney(payload.deductions.other)}</dd></div> : null}
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900"><dt>Total deductions</dt><dd>{formatMoney(payload.deductions.total)}</dd></div>
          </dl>
        </section>
      </div>

      {payload.sources?.length ? (
        <section className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Work locations</h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">Time</th><th className="px-3 py-2 text-right">Hours</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {payload.sources.map((source) => (
                  <tr key={source.entryId}><td className="px-3 py-2">{source.periodStart ?? "-"}</td><td className="px-3 py-2">{source.site || "-"}</td><td className="px-3 py-2">{source.startTime && source.endTime ? `${source.startTime} to ${source.endTime}` : "-"}</td><td className="px-3 py-2 text-right">{source.hoursWorked}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="mt-8 rounded-lg bg-brand px-6 py-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Net pay</p>
        <p className="mt-2 text-4xl font-semibold">{formatMoney(payload.totals.net)}</p>
      </div>
    </article>
  );
}
