"use client";

import { authenticatedFetch } from "@/lib/api";
import { ROLE_OPTIONS } from "@/lib/role-options";
import { userStatusBadgeClass, userStatusLabel } from "@/lib/user-status";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type UserDetail = {
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

type PendingInv = { id: string; expiresAt: string; createdAt: string } | null;

type Emp = { id: string; fullName: string };

function canEditProfile(status: string): boolean {
  return status === "active" || status === "invited";
}

export default function UserDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [pendingInvitation, setPendingInvitation] = useState<PendingInv | undefined>(undefined);
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
      authenticatedFetch(`/admin/users/${encodeURIComponent(id)}`),
      authenticatedFetch("/people/employees")
    ]);
    const j = (await res.json()) as { error?: string; user?: UserDetail; pendingInvitation?: PendingInv };
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
    return { user: j.user, pending: j.pendingInvitation ?? null };
  }, [id]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await load();
        if (c) {
          return;
        }
        setUser(data.user);
        setPendingInvitation(data.pending);
        setEmail(data.user.email);
        setName(data.user.name);
        setEmployeeId(data.user.employeeId ?? "");
        const o: Record<string, boolean> = {};
        for (const r of ROLE_OPTIONS) {
          o[r.value] = data.user.roles.includes(r.value);
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
    if (!canEditProfile(user.status)) {
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
      if (user.status === "active" && newPassword.trim().length > 0) {
        if (newPassword.length < 8) {
          setError("New password must be at least 8 characters.");
          setSaving(false);
          return;
        }
        body.password = newPassword;
      }
      const res = await authenticatedFetch(`/admin/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
      body: JSON.stringify(body)
      });
      const j = (await res.json()) as { error?: string; user?: UserDetail; pendingInvitation?: PendingInv };
      if (res.status === 403) {
        throw new Error("Only a platform owner can update users.");
      }
      if (!res.ok) {
        throw new Error(j.error ?? res.statusText);
      }
      if (j.user) {
        setUser(j.user);
        setPendingInvitation(j.pendingInvitation ?? null);
        setNewPassword("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onSuspend() {
    if (!user || user.status !== "active" || !window.confirm("Suspend this user? They will not be able to sign in.")) {
      return;
    }
    setActBusy(true);
    setError(null);
    try {
      const res = await authenticatedFetch(`/admin/users/${encodeURIComponent(id)}/suspend`, {
        method: "POST"
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

  async function onDeactivate() {
    if (!user) {
      return;
    }
    if (
      !window.confirm("Deactivate this user? They will not be able to sign in. Pending invites will be revoked.")
    ) {
      return;
    }
    setActBusy(true);
    setError(null);
    try {
      const res = await authenticatedFetch(`/admin/users/${encodeURIComponent(id)}/deactivate`, {
        method: "POST"
      });
      const j = (await res.json()) as { error?: string; user?: UserDetail };
      if (!res.ok) {
        throw new Error(j.error ?? res.statusText);
      }
      if (j.user) {
        setUser(j.user);
        setPendingInvitation(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setActBusy(false);
    }
  }

  async function onReactivate() {
    if (!user || user.status === "active" || user.status === "invited") {
      return;
    }
    if (!window.confirm("Reactivate this user? They will need to sign in again on other devices.")) {
      return;
    }
    setActBusy(true);
    setError(null);
    try {
      const res = await authenticatedFetch(`/admin/users/${encodeURIComponent(id)}/reactivate`, {
        method: "POST"
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

  const edit = canEditProfile(user.status);
  const showPassword = user.status === "active";

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
          {user.status === "active" ? (
            <>
              <button
                type="button"
                onClick={() => void onSuspend()}
                disabled={actBusy}
                className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-900 disabled:opacity-50"
              >
                Suspend
              </button>
              <button
                type="button"
                onClick={() => void onDeactivate()}
                disabled={actBusy}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 disabled:opacity-50"
              >
                Deactivate
              </button>
            </>
          ) : null}
          {user.status === "suspended" ? (
            <>
              <button
                type="button"
                onClick={() => void onReactivate()}
                disabled={actBusy}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 disabled:opacity-50"
              >
                Reactivate
              </button>
              <button
                type="button"
                onClick={() => void onDeactivate()}
                disabled={actBusy}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 disabled:opacity-50"
              >
                Deactivate
              </button>
            </>
          ) : null}
          {user.status === "deactivated" ? (
            <button
              type="button"
              onClick={() => void onReactivate()}
              disabled={actBusy}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 disabled:opacity-50"
            >
              Reactivate
            </button>
          ) : null}
          {user.status === "invited" ? (
            <button
              type="button"
              onClick={() => void onDeactivate()}
              disabled={actBusy}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 disabled:opacity-50"
            >
              Cancel invitation
            </button>
          ) : null}
        </div>
      </div>

      <p>
        <span className={`rounded-full px-2 py-0.5 text-sm ${userStatusBadgeClass(user.status)}`}>
          {userStatusLabel(user.status)}
        </span>
        {user.status === "invited" ? (
          <span className="ml-2 text-sm text-amber-800">
            Awaiting accept-invite. Share the link from the invite response (dev) or the pending list.
          </span>
        ) : null}
      </p>

      {pendingInvitation ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Pending invitation expires {new Date(pendingInvitation.expiresAt).toLocaleString()}.
        </p>
      ) : null}

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
            disabled={!edit}
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
            disabled={!edit}
          />
        </label>
        {showPassword ? (
          <label className="block text-sm">
            <span className="text-slate-700">New password (leave blank to keep current)</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
              autoComplete="new-password"
              minLength={8}
            />
          </label>
        ) : null}
        <fieldset className="text-sm" disabled={!edit}>
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
            disabled={!edit}
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
            disabled={saving || !edit}
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
