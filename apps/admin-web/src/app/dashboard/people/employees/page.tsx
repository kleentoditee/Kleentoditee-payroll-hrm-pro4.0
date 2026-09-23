"use client";

import { EmployeeAvatar } from "@/components/employee-avatar";
import { BulkOnboardingCard } from "@/components/bulk-onboarding";
import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useEffect, useState } from "react";

type EmployeeRow = {
  id: string;
  fullName: string;
  role: string;
  defaultSite: string;
  phone: string;
  email: string;
  active: boolean;
  basePayType: string;
  paySchedule: string;
  template: { name: string };
  hasProfilePhoto: boolean;
  linkedUser: { email: string; status: string } | null;
};

export default function EmployeesListPage() {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"current" | "archived">("current");
  const [items, setItems] = useState<EmployeeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const qs = new URLSearchParams({ status: view });
          if (q.trim()) qs.set("q", q.trim());
          const res = await fetch(`${apiBase()}/people/employees?${qs.toString()}`, {
            headers: { ...authHeaders() }
          });
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
  }, [q, view]);

  async function changeArchiveStatus(employee: EmployeeRow) {
    const archive = view === "current";
    if (archive && !window.confirm(`Archive ${employee.fullName}? They will be removed from Current employees and any tracker login will be suspended.`)) {
      return;
    }
    setUpdatingId(employee.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${apiBase()}/people/employees/${employee.id}/${archive ? "archive" : "restore"}`, {
        method: "POST",
        headers: { ...authHeaders() }
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? res.statusText);
      }
      setItems((current) => current?.filter((item) => item.id !== employee.id) ?? []);
      setNotice(
        archive
          ? `${employee.fullName} was moved to Archived employees.`
          : `${employee.fullName} was restored. Tracker access remains off until an administrator reactivates it.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update employee");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">People</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">
            {view === "current" ? "Employees" : "Archived employees"}
          </h2>
        </div>
        <Link
          href="/dashboard/people/employees/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          Add employee
        </Link>
      </div>

      <div className="flex w-fit rounded-lg border border-slate-200 bg-white p-1" aria-label="Employee list view">
        <button
          type="button"
          onClick={() => setView("current")}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === "current" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50"}`}
        >
          Current
        </button>
        <button
          type="button"
          onClick={() => setView("archived")}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === "archived" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50"}`}
        >
          Archived
        </button>
      </div>

      <label className="block max-w-md text-sm">
        <span className="text-slate-700">Search</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, email, role, or site"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
        />
      </label>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{notice}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">
          {view === "current" ? "No current employees found." : "No archived employees found."}
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
                  <Link
                    href={`/dashboard/people/employees/${employee.id}`}
                    className="font-semibold text-brand hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    aria-label={`Edit ${employee.fullName}`}
                  >
                    {employee.fullName}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {employee.email ? (
                      <a className="text-brand hover:underline" href={`mailto:${employee.email}`}>{employee.email}</a>
                    ) : employee.linkedUser ? (
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
              <div className="flex items-center gap-4">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    employee.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {employee.active ? "Active" : "Inactive"}
                </span>
                <button
                  type="button"
                  onClick={() => void changeArchiveStatus(employee)}
                  disabled={updatingId === employee.id}
                  className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold disabled:opacity-50 ${
                    view === "current"
                      ? "border-red-200 text-red-700 hover:bg-red-50"
                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  {updatingId === employee.id ? "Working..." : view === "current" ? "Archive" : "Restore"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <BulkOnboardingCard />
    </div>
  );
}
