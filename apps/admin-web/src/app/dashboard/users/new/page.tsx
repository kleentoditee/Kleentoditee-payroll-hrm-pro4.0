"use client";

import { authenticatedFetch } from "@/lib/api";
import { ROLE_OPTIONS } from "@/lib/role-options";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Emp = { id: string; fullName: string };

export default function InviteUserPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<Emp[] | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    for (const r of ROLE_OPTIONS) {
      o[r.value] = false;
    }
    return o;
  });
  const [employeeId, setEmployeeId] = useState("");
  const [devNote, setDevNote] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await authenticatedFetch("/people/employees");
        if (res.status === 403) {
          throw new Error("Only a platform owner can invite users.");
        }
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          throw new Error(j.error ?? res.statusText);
        }
        const data = (await res.json()) as { items: Emp[] };
        if (!c) {
          setEmployees(data.items);
        }
      } catch (e) {
        if (!c) {
          setError(e instanceof Error ? e.message : "Failed to load employees");
          setEmployees([]);
        }
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  function toggleRole(value: string) {
    setSelectedRoles((prev) => ({ ...prev, [value]: !prev[value] }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDevNote(null);
    const roles = ROLE_OPTIONS.map((r) => r.value).filter((k) => selectedRoles[k]);
    if (roles.length === 0) {
      setError("Select at least one role.");
      return;
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch("/admin/users/invite", {
        method: "POST",
      body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          roles,
          employeeId: employeeId.trim() || null
        })
      });
      const j = (await res.json()) as {
        error?: string;
        user?: { id: string };
        devInvitePath?: string;
        devMessage?: string;
      };
      if (res.status === 403) {
        throw new Error("Only a platform owner can invite users.");
      }
      if (!res.ok) {
        throw new Error(j.error ?? res.statusText);
      }
      if (j.devInvitePath) {
        setDevNote(
          `Non-production: open the admin app at ${j.devInvitePath} (appended to the site base URL) so the user can set a password.`
        );
        return;
      }
      if (j.devMessage) {
        setDevNote(j.devMessage);
        return;
      }
      if (j.user?.id) {
        router.push(`/dashboard/users/${j.user.id}`);
      } else {
        router.push("/dashboard/users");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Access</p>
        <h2 className="mt-1 font-serif text-2xl text-slate-900">Invite user</h2>
        <p className="mt-2 text-sm text-slate-600">
          Sends a one-time invitation (email delivery is not wired yet). The invited person sets their password on the
          accept-invite page.
        </p>
      </div>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}
      {devNote ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{devNote}</p>
      ) : null}
      <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm">
          <span className="text-slate-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Display name (optional)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            autoComplete="off"
            placeholder="Defaults from the email if empty"
          />
        </label>
        <fieldset className="text-sm">
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
          <span className="text-slate-700">Link to employee (optional, for mobile tracker)</span>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none ring-brand focus:ring-2"
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
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:opacity-50"
          >
            {saving ? "Sending…" : "Create invitation"}
          </button>
          <Link href="/dashboard/users" className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
