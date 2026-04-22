"use client";

export default function TrackerHome() {
  const soon = (label: string) => {
    window.alert(
      `${label} is not wired up yet.\n\nThis screen is the new employee app (Phase 1 stub). Real clock in/out will use the API in Phase 2.\n\nFor the working payroll app with your data, use the legacy app at http://localhost:8081 (see README).`
    );
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-8">
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">KleenToDiTee</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Employee tracker</h1>
        <p className="mt-2 text-sm text-slate-600">
          Phase 1 preview only — your saved employees and payroll live in the legacy app (port 8081), not here.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-4">
        <button
          type="button"
          className="rounded-2xl bg-brand py-4 text-lg font-semibold text-white shadow-lg shadow-brand/25 active:opacity-90"
          onClick={() => soon("Clock in")}
        >
          Clock in
        </button>
        <button
          type="button"
          className="rounded-2xl border-2 border-brand/30 bg-white py-4 text-lg font-semibold text-brand active:opacity-90"
          onClick={() => soon("Start break")}
        >
          Start break
        </button>
        <p className="text-center text-xs text-slate-500">
          Tapping a button explains the split between this preview and the real payroll tool.
        </p>
      </div>
    </div>
  );
}
