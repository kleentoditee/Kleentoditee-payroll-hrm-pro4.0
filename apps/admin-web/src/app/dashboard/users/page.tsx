"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  employeeId: string | null;
  createdAt: string;
  updatedAt: string;
  roles: string[];
  employee: { id: string; fullName: string } | null;
};

export default function UsersListPage() {
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("all");
  const [items, setItems] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = activeFilter === "all" ? "" : `?active=${activeFilter}`;
    const res = await fetch(`${apiBase()}/admin/users${qs}`, { headers: { ...authHeaders() } });
    const j = (await res.json()) as { error?: string; items?: UserRow[] };
    if (res.status === 403) {
      throw new Error("Only a platform owner can manage users.");
    }
    if (!res.ok) {
      throw new Error(j.error ?? res.statusText);
    }
    return j.items ?? [];
  }, [activeFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await load();
        if (!cancelled) {
          setItems(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setItems(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Access</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Users</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Create logins, assign roles, and link an employee for the mobile time tracker. Only platform owners can
            use this page.
          </p>
        </div>
        <Link
          href="/dashboard/users/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          New user
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-600">Status</span>
        {(["all", "true", "false"] as const).map((k) => (
          <label key={k} className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              name="uf"
              checked={activeFilter === k}
              onChange={() => setActiveFilter(k)}
            />
            {k === "all" ? "All" : k === "true" ? "Active" : "Inactive"}
          </label>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">No users match this filter.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((u) => (
            <li key={u.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link
                  href={`/dashboard/users/${u.id}`}
                  className="font-medium text-slate-900 hover:text-brand hover:underline"
                >
                  {u.name}
                </Link>
                <p className="text-sm text-slate-600">{u.email}</p>
                {u.employee ? (
                  <p className="text-xs text-slate-500">Employee: {u.employee.fullName}</p>
                ) : null}
                <p className="mt-1 text-xs text-slate-500">Roles: {u.roles.join(", ")}</p>
              </div>
              <div className="shrink-0 text-sm">
                {u.active ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-900">Active</span>
                ) : (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-800">Inactive</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p>
        <Link href="/dashboard" className="text-sm font-semibold text-brand hover:underline">
          ← Dashboard
        </Link>
      </p>
    </div>
  );
}
