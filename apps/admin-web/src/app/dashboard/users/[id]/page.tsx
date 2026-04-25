"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { ROLE_OPTIONS } from "@/lib/role-options";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type UserDetail = {
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

type Emp = { id: string; fullName: string };

export default function UserDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [employees, setEmployees] = useState<Emp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actBusy, setActBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Record<string, boolean>>({});
  const [employeeId, setEmployeeId] = useState("");

  const load = useCallback(async () => {
    const [res, eres] = await Promise.all([
      fetch(`${apiBase()}/admin/users/${encodeURIComponent(id)}`, { headers: { ...authHeaders() } }),
      fetch(`${apiBase()}/people/employees`, { headers: { ...authHeaders() } })
    ]);
    const j = (await res.json()) as { error?: string; user?: UserDetail };
    if (res.status === 403) {
      throw new Error("Only a platform owner can manage users.");
    }
    if (!res.ok) {
      throw new Error(j.error ?? res.statusText);
    }
    if (!j.user) {
      throw new Error("Not found");
    }
    if (eres.ok) {
      const ejson = (await eres.json()) as { items: Emp[] };
      setEmployees(ejson.items);
    } else {
      setEmployees([]);
    }
    return j.user;
  }, [id]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const u = await load();
        if (c) {
          return;
        }
        setUser(u);
        setEmail(u.email);
        setName(u.name);
        setEmployeeId(u.employeeId ?? "");
        const o: Record<string, boolean> = {};
        for (const r of ROLE_OPTIONS) {
          o[r.value] = u.roles.includes(r.value);
        }
        setSelectedRoles(o);
        setError(null);
      } catch (e) {
        if (!c) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setUser(null);
        }
      }
    })();
    return () => {
      c = true;
    };
  }, [load]);

  function toggleRole(value: string) {
    setSelectedRoles((prev) => ({ ...prev, [value]: !prev[value] }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      return;
    }
    setError(null);
    const roles = ROLE_OPTIONS.map((r) => r.value).filter((k) => selectedRoles[k]);
    if (roles.length === 0) {
      setError("Select at least one role.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        email: email.trim(),
        name: name.trim(),
        roles,
        employeeId: employeeId.trim() || null
      };
      if (newPassword.trim().length > 0) {
        if (newPassword.length < 8) {
          setError("New password must be at least 8 characters.");
          setSaving(false);
          return;
        }
        body.password = newPassword;
      }
      const res = await fetch(`${apiBase()}/admin/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body)
      });
      const j = (await res.json()) as { error?: string; user?: UserDetail };
      if (res.status === 403) {
        throw new Error("Only a platform owner can update users.");
      }
      if (!res.ok) {
        throw new Error(j.error ?? res.statusText);
      }
      if (j.user) {
        setUser(j.user);
        setNewPassword("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDeactivate() {
    if (!user?.active || !window.confirm("Deactivate this user? They will not be able to sign in.")) {
      return;
    }
    setActBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/admin/users/${encodeURIComponent(id)}/deactivate`, {
        method: "POST",
        headers: { ...authHeaders() }
      });
      const j = (await res.json()) as { error?: string; user?: UserDetail };
      if (!res.ok) {
        throw new Error(j.error ?? res.statusText);
      }
      if (j.user) {
        setUser(j.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setActBusy(false);
    }
  }

  async function onReactivate() {
    if (!user || user.active) {
      return;
    }
    if (!window.confirm("Reactivate this user?")) {
      return;
    }
    setActBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/admin/users/${encodeURIComponent(id)}/reactivate`, {
        method: "POST",
        headers: { ...authHeaders() }
      });
      const j = (await res.json()) as { error?: string; user?: UserDetail };
      if (!res.ok) {
        throw new Error(j.error ?? res.statusText);
      }
      if (j.user) {
        setUser(j.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setActBusy(false);
    }
  }

  if (!user && !error) {
    return (
      <div className="text-sm text-slate-600">
        <p>Loading…</p>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="space-y-4">
        <p className="text-red-700">{error}</p>
        <Link href="/dashboard/users" className="text-sm font-semibold text-brand">
          ← Users
        </Link>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Access</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">User</h2>
          <p className="mt-1 text-sm text-slate-500">
            Created {user.createdAt.slice(0, 10)} · Updated {user.updatedAt.slice(0, 10)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.active ? (
            <button
              type="button"
              onClick={() => void onDeactivate()}
              disabled={actBusy}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 disabled:opacity-50"
            >
              Deactivate
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onReactivate()}
              disabled={actBusy}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 disabled:opacity-50"
            >
              Reactivate
            </button>
          )}
        </div>
      </div>

      {user.active ? (
        <p>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-sm text-emerald-900">Active</span>
        </p>
      ) : (
        <p>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-sm text-slate-800">Inactive</span>
        </p>
      )}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <form onSubmit={onSave} className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm">
          <span className="text-slate-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            disabled={!user.active}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            disabled={!user.active}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">New password (leave blank to keep current)</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            autoComplete="new-password"
            disabled={!user.active}
            minLength={8}
          />
        </label>
        <fieldset className="text-sm" disabled={!user.active}>
          <legend className="text-slate-700">Roles</legend>
          <ul className="mt-2 space-y-2">
            {ROLE_OPTIONS.map((r) => (
              <li key={r.value}>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={!!selectedRoles[r.value]} onChange={() => toggleRole(r.value)} />
                  {r.label}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <label className="block text-sm">
          <span className="text-slate-700">Link to employee (optional)</span>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none ring-brand focus:ring-2"
            disabled={!user.active}
          >
            <option value="">— None —</option>
            {employees?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !user.active}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/users")}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700"
          >
            Back to list
          </button>
        </div>
      </form>
    </div>
  );
}
