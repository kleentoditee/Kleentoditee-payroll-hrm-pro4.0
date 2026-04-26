"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { userStatusBadgeClass, userStatusLabel } from "@/lib/user-status";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string;
  status: string;
  employeeId: string | null;
  createdAt: string;
  updatedAt: string;
  roles: string[];
  employee: { id: string; fullName: string } | null;
};

type PendingInv = {
  id: string;
  userId: string;
  email: string;
  name: string;
  userStatus: string;
  expiresAt: string;
  createdAt: string;
};

const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "invited", label: "Invited" },
  { id: "suspended", label: "Suspended" },
  { id: "deactivated", label: "Deactivated" }
];

export default function UsersListPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [items, setItems] = useState<UserRow[] | null>(null);
  const [pending, setPending] = useState<PendingInv[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
    const res = await fetch(`${apiBase()}/admin/users${qs}`, { headers: { ...authHeaders() } });
    const j = (await res.json()) as { error?: string; items?: UserRow[] };
    if (res.status === 403) {
      throw new Error("Only a platform owner can manage users.");
    }
    if (!res.ok) {
      throw new Error(j.error ?? res.statusText);
    }
    return j.items ?? [];
  }, [statusFilter]);

  const loadPending = useCallback(async () => {
    const res = await fetch(`${apiBase()}/admin/users/invitations/pending`, { headers: { ...authHeaders() } });
    if (res.status === 403) {
      return [];
    }
    if (!res.ok) {
      return [];
    }
    const j = (await res.json()) as { items?: PendingInv[] };
    return j.items ?? [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, pend] = await Promise.all([load(), loadPending()]);
        if (!cancelled) {
          setItems(data);
          setPending(pend);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setItems(null);
          setPending(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, loadPending]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Access</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Users</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Invite people by email, assign roles, and link an employee for the mobile time tracker. Only platform
            owners can use this page.
          </p>
        </div>
        <Link
          href="/dashboard/users/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          Invite user
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-600">Status</span>
        {STATUS_FILTERS.map((k) => (
          <label key={k.id} className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              name="uf"
              checked={statusFilter === k.id}
              onChange={() => setStatusFilter(k.id)}
            />
            {k.label}
          </label>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {pending && pending.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Pending invitations (not yet accepted)</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-amber-900/90">
            {pending.map((p) => (
              <li key={p.id}>
                {p.name} ({p.email}) — expires {new Date(p.expiresAt).toLocaleString()}{" "}
                <Link className="font-medium text-brand hover:underline" href={`/dashboard/users/${p.userId}`}>
                  Open user
                </Link>
              </li>
            ))}
          </ul>
        </div>
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
                <span
                  className={`rounded-full px-2 py-0.5 ${userStatusBadgeClass(u.status)}`}
                >
                  {userStatusLabel(u.status)}
                </span>
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
