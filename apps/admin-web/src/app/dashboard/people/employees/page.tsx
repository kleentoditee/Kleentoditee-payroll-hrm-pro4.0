"use client";

import { EmployeeAvatar } from "@/components/employee-avatar";
import { authenticatedFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type EmployeeRow = {
  id: string;
  fullName: string;
  role: string;
  defaultSite: string;
  phone: string;
  active: boolean;
  basePayType: string;
  paySchedule: string;
  template: { name: string };
  hasProfilePhoto: boolean;
  linkedUser: { email: string; status: string } | null;
};

export default function EmployeesListPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<EmployeeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
          const res = await authenticatedFetch(`/people/employees${qs}`);
          if (!res.ok) {
            const j = (await res.json()) as { error?: string };
            throw new Error(j.error ?? res.statusText);
          }
          const data = (await res.json()) as { items: EmployeeRow[] };
          if (!cancelled) {
            setItems(data.items);
            setError(null);
          }
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Failed to load");
            setItems(null);
          }
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">People</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Employees</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Master records for payroll. Employees now carry both a pay basis and a pay schedule so payroll runs
            can group monthly, weekly, and biweekly staff correctly.
          </p>
        </div>
        <Link
          href="/dashboard/people/employees/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          Add employee
        </Link>
      </div>

      <label className="block max-w-md text-sm">
        <span className="text-slate-700">Search</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, role, or site"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
        />
      </label>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">
          No employees yet. Add one or run <code className="rounded bg-slate-100 px-1">npm run db:seed</code>{" "}
          after pulling schema updates.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((employee) => (
            <li key={employee.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <EmployeeAvatar
                  employeeId={employee.id}
                  hasPhoto={employee.hasProfilePhoto}
                  name={employee.fullName}
                  sizeClassName="h-11 w-11 text-xs"
                  profilePhotoViewUrl={`/people/employees/${employee.id}/profile-photo`}
                />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{employee.fullName}</p>
                  <p className="text-sm text-slate-600">
                    {employee.linkedUser ? (
                      <span className="text-slate-800">{employee.linkedUser.email}</span>
                    ) : (
                      <span className="italic text-slate-500">No linked user</span>
                    )}
                    <span className="text-slate-400"> · </span>
                    {employee.phone || "— phone"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {employee.role || "-"} | {employee.defaultSite || "No site"} | {employee.basePayType} |{" "}
                    {employee.paySchedule} · {employee.template.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    employee.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {employee.active ? "Active" : "Inactive"}
                </span>
                <Link
                  href={`/dashboard/people/employees/${employee.id}`}
                  className="text-sm font-semibold text-brand hover:underline"
                >
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
