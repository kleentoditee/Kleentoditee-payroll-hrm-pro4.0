"use client";

import { EmployeeAvatar } from "@/components/employee-avatar";
import { ShareTrackerAccessCard } from "@/components/share-tracker-access-card";
import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { canViewEmployeePii } from "@/lib/hr-roles";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Template = { id: string; name: string };

type DocumentRow = {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  downloadUrl: string;
};

type EmployeeFromApi = {
  id: string;
  fullName: string;
  role: string;
  defaultSite: string;
  phone: string;
  basePayType: "daily" | "hourly" | "fixed";
  paySchedule: "weekly" | "biweekly" | "monthly";
  dailyRate: number;
  hourlyRate: number;
  overtimeRate: number;
  fixedPay: number;
  standardDays: number;
  standardHours: number;
  templateId: string;
  template: { id: string; name: string };
  active: boolean;
  notes: string;
  profilePhotoViewUrl: string;
  hasProfilePhoto: boolean;
  socialSecurityNumber: string;
  nationalHealthInsuranceNumber: string;
  inlandRevenueDepartmentNumber: string;
  workPermitNumber: string;
  employmentStartDate: string | null;
  employmentEndDate: string | null;
  workPermitExpiryDate: string | null;
  sensitiveExposed: boolean;
  documents: DocumentRow[];
  linkedUser: { email: string; status: string } | null;
};

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) {
    return "";
  }
  return iso.slice(0, 10);
}

async function downloadAuthedFile(downloadUrl: string, fileName: string) {
  const res = await fetch(`${apiBase()}${downloadUrl}`, { headers: { ...authHeaders() } });
  if (!res.ok) {
    return;
  }
  const b = await res.blob();
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(u);
}

type RevealableProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  canReveal: boolean;
  help?: string;
};

function RevealableField({ id, label, value, onChange, disabled, canReveal, help }: RevealableProps) {
  const [revealed, setRevealed] = useState(false);
  const isMasked = value.trimStart().startsWith("•");
  return (
    <div className="text-sm">
      <label className="block" htmlFor={id}>
        <span className="text-slate-700">{label}</span>
        {canReveal && !isMasked ? (
          <div className="mt-1 flex gap-1">
            <input
              id={id}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              type={revealed ? "text" : "password"}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="shrink-0 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {revealed ? "Hide" : "Show"}
            </button>
          </div>
        ) : (
          <input
            id={id}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || isMasked}
            title={isMasked ? "Use an HR or payroll account to view and edit" : undefined}
          />
        )}
      </label>
      {help ? <p className="mt-1 text-xs text-slate-500">{help}</p> : null}
    </div>
  );
}

export default function EditEmployeePage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const router = useRouter();

  const [meRoles, setMeRoles] = useState<string[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [avatarTick, setAvatarTick] = useState(0);
  const [docTick, setDocTick] = useState(0);

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [defaultSite, setDefaultSite] = useState("");
  const [phone, setPhone] = useState("");
  const [basePayType, setBasePayType] = useState<"daily" | "hourly" | "fixed">("daily");
  const [paySchedule, setPaySchedule] = useState<"weekly" | "biweekly" | "monthly">("monthly");
  const [dailyRate, setDailyRate] = useState("0");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [overtimeRate, setOvertimeRate] = useState("0");
  const [fixedPay, setFixedPay] = useState("0");
  const [standardDays, setStandardDays] = useState("0");
  const [standardHours, setStandardHours] = useState("0");
  const [templateId, setTemplateId] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [ssn, setSsn] = useState("");
  const [nhi, setNhi] = useState("");
  const [ird, setIrd] = useState("");
  const [workPermit, setWorkPermit] = useState("");
  const [empStart, setEmpStart] = useState("");
  const [empEnd, setEmpEnd] = useState("");
  const [wpExp, setWpExp] = useState("");
  const [sensitiveExposed, setSensitiveExposed] = useState(false);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [profilePhotoViewUrl, setProfilePhotoViewUrl] = useState("");

  const canPii = canViewEmployeePii(meRoles ?? undefined) && meRoles != null;
  const canEditPii = canPii;
  const formDisabledPii = !canEditPii;

  const loadEmployee = useCallback(async () => {
    const employeeRes = await fetch(`${apiBase()}/people/employees/${id}`, { headers: { ...authHeaders() } });
    if (!employeeRes.ok) {
      throw new Error("Failed to load");
    }
    const employeeData = (await employeeRes.json()) as { employee: EmployeeFromApi };
    const e = employeeData.employee;
    setFullName(e.fullName);
    setRole(e.role);
    setDefaultSite(e.defaultSite);
    setPhone(e.phone);
    setBasePayType(e.basePayType);
    setPaySchedule(e.paySchedule);
    setDailyRate(String(e.dailyRate));
    setHourlyRate(String(e.hourlyRate));
    setOvertimeRate(String(e.overtimeRate));
    setFixedPay(String(e.fixedPay));
    setStandardDays(String(e.standardDays));
    setStandardHours(String(e.standardHours));
    setTemplateId(e.templateId);
    setNotes(e.notes);
    setActive(e.active);
    setSsn(e.socialSecurityNumber ?? "");
    setNhi(e.nationalHealthInsuranceNumber ?? "");
    setIrd(e.inlandRevenueDepartmentNumber ?? "");
    setWorkPermit(e.workPermitNumber ?? "");
    setEmpStart(isoToDateInput(e.employmentStartDate));
    setEmpEnd(isoToDateInput(e.employmentEndDate));
    setWpExp(isoToDateInput(e.workPermitExpiryDate));
    setSensitiveExposed(e.sensitiveExposed);
    setDocuments(e.documents ?? []);
    setHasPhoto(e.hasProfilePhoto === true);
    setProfilePhotoViewUrl(e.profilePhotoViewUrl || `/people/employees/${e.id}/profile-photo`);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [meRes, templateRes] = await Promise.all([
          fetch(`${apiBase()}/auth/me`, { headers: { ...authHeaders() } }),
          fetch(`${apiBase()}/people/templates`, { headers: { ...authHeaders() } })
        ]);
        if (meRes.ok) {
          const me = (await meRes.json()) as { user: { roles: string[] } };
          if (!cancelled) {
            setMeRoles(me.user.roles);
          }
        } else if (!cancelled) {
          setMeRoles([]);
        }
        if (templateRes.ok) {
          const templateData = (await templateRes.json()) as { items: Template[] };
          if (!cancelled) {
            setTemplates(templateData.items);
          }
        }
        if (id) {
          await loadEmployee();
        }
        if (!cancelled) {
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load employee.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadEmployee]);

  async function onUpload(file: File, type: string) {
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    const res = await fetch(`${apiBase()}/people/employees/${id}/documents`, {
      method: "POST",
      body: fd,
      headers: { ...authHeaders() }
    });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Upload failed");
      return;
    }
    setDocTick((n) => n + 1);
    if (type === "PHOTO") {
      setAvatarTick((n) => n + 1);
      setHasPhoto(true);
    }
    await loadEmployee();
  }

  async function onDeleteDoc(docId: string) {
    if (!window.confirm("Remove this file from the employee record? (Soft-deleted; audit retained.)")) {
      return;
    }
    setError(null);
    const res = await fetch(`${apiBase()}/people/employees/${id}/documents/${docId}`, {
      method: "DELETE",
      headers: { ...authHeaders() }
    });
    if (!res.ok) {
      setError("Delete failed");
      return;
    }
    await loadEmployee();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        fullName,
        role,
        defaultSite,
        phone,
        basePayType,
        paySchedule,
        dailyRate: Number(dailyRate),
        hourlyRate: Number(hourlyRate),
        overtimeRate: Number(overtimeRate),
        fixedPay: Number(fixedPay),
        standardDays: Number(standardDays),
        standardHours: Number(standardHours),
        templateId,
        notes,
        active,
        employmentStartDate: empStart || null,
        employmentEndDate: empEnd || null,
        workPermitExpiryDate: wpExp || null
      };
      if (canEditPii) {
        body.socialSecurityNumber = ssn;
        body.nationalHealthInsuranceNumber = nhi;
        body.inlandRevenueDepartmentNumber = ird;
        body.workPermitNumber = workPermit;
      }
      const res = await fetch(`${apiBase()}/people/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body)
      });
      const data = (await res.json()) as { error?: string; employee?: EmployeeFromApi };
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      if (data.employee) {
        setSensitiveExposed(data.employee.sensitiveExposed);
      }
      router.refresh();
      await loadEmployee();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this employee? This cannot be undone.")) {
      return;
    }
    const res = await fetch(`${apiBase()}/people/employees/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() }
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    router.replace("/dashboard/people/employees");
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-serif text-xl text-slate-900">Employee record (HR & payroll)</h2>
        <Link href="/dashboard/people/employees" className="text-sm font-semibold text-brand hover:underline">
          {"<-"} Back
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <EmployeeAvatar
          key={avatarTick}
          employeeId={id}
          hasPhoto={hasPhoto}
          name={fullName}
          sizeClassName="h-20 w-20 text-base"
          profilePhotoViewUrl={profilePhotoViewUrl}
        />
        <div>
          <p className="text-sm font-medium text-slate-900">Profile photo</p>
          <p className="text-xs text-slate-500">Used on the people list. Upload a small square image; stored on the API server in dev only.</p>
          <input
            type="file"
            accept="image/*"
            className="mt-2 text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                void onUpload(f, "PHOTO");
              }
              e.target.value = "";
            }}
          />
        </div>
      </section>

      {meRoles != null && !canPii && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You can view and edit this profile, but <strong>government IDs and work permit numbers</strong> are only shown in
          full to platform owner, hr_admin, and payroll_admin.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Contact & role</h3>
          <label className="block text-sm">
            <span className="text-slate-700">Full name</span>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-700">Work role (label)</span>
              <input value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Default site</span>
              <input
                value={defaultSite}
                onChange={(e) => setDefaultSite(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-700">Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <p className="text-sm text-slate-600">
            <span className="font-medium">Linked app login:</span>{" "}
            <span className="text-slate-500">
              See <Link className="font-semibold text-brand hover:underline" href="/dashboard/users">Users &amp; roles</Link> to link
              a tracker account to this record.
            </span>
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Employment</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-700">Employment start</span>
              <input type="date" value={empStart} onChange={(e) => setEmpStart(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Employment end</span>
              <input type="date" value={empEnd} onChange={(e) => setEmpEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Work permit expiry</span>
              <input type="date" value={wpExp} onChange={(e) => setWpExp(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Payroll & government numbers</h3>
          <p className="text-xs text-slate-500">Stored in the platform database. Never put these values in emails, WhatsApp, or public links. Audit trail records that they changed, not the new values.</p>
          {formDisabledPii ? (
            <p className="text-sm text-amber-800">Your role cannot edit SSN, NHI, or IRD numbers. Ask a platform owner or HR/payroll admin to update this section.</p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-1">
            <RevealableField
              id="ssn"
              label="Social security number (SSN)"
              value={ssn}
              onChange={setSsn}
              disabled={formDisabledPii}
              canReveal={sensitiveExposed && canEditPii}
              help={!sensitiveExposed ? "Value shown masked. Full values require platform owner, hr_admin, or payroll_admin." : undefined}
            />
            <RevealableField
              id="nhi"
              label="National health insurance (NHI) number"
              value={nhi}
              onChange={setNhi}
              disabled={formDisabledPii}
              canReveal={sensitiveExposed && canEditPii}
            />
            <RevealableField
              id="ird"
              label="Inland revenue department (IRD) number"
              value={ird}
              onChange={setIrd}
              disabled={formDisabledPii}
              canReveal={sensitiveExposed && canEditPii}
            />
            <RevealableField
              id="wp"
              label="Work permit number"
              value={workPermit}
              onChange={setWorkPermit}
              disabled={formDisabledPii}
              canReveal={sensitiveExposed && canEditPii}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pay rates & schedule</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-700">Pay basis</span>
              <select
                value={basePayType}
                onChange={(e) => setBasePayType(e.target.value as typeof basePayType)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="daily">Daily rate</option>
                <option value="hourly">Hourly</option>
                <option value="fixed">Fixed monthly</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Pay schedule</span>
              <select
                value={paySchedule}
                onChange={(e) => setPaySchedule(e.target.value as typeof paySchedule)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-700">Daily rate</span>
              <input
                type="number"
                step="0.01"
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Hourly rate</span>
              <input
                type="number"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Overtime rate</span>
              <input
                type="number"
                step="0.01"
                value={overtimeRate}
                onChange={(e) => setOvertimeRate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Fixed pay</span>
              <input
                type="number"
                step="0.01"
                value={fixedPay}
                onChange={(e) => setFixedPay(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Standard days</span>
              <input
                type="number"
                step="0.5"
                value={standardDays}
                onChange={(e) => setStandardDays(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Standard hours</span>
              <input
                type="number"
                step="0.5"
                value={standardHours}
                onChange={(e) => setStandardHours(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-700">Deduction template</span>
            <select
              required
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active for payroll
          </label>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Documents (soft-delete)</h3>
          <p className="text-xs text-slate-500" key={docTick}>
            In development, files are written under the API <code>uploads/hr</code> tree (excluded from git). Types: work permit, NHI card, ID, contract, or other. Platform owner, hr_admin, and payroll_admin can download identity documents; others can download non-ID attachments only.
          </p>
          <ul className="space-y-2 text-sm">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                <span>
                  <span className="font-medium text-slate-800">{d.type}</span> · {d.fileName}{" "}
                  <span className="text-slate-500">({Math.round(d.sizeBytes / 1024)} KB)</span>
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand hover:underline"
                    onClick={() => void downloadAuthedFile(d.downloadUrl, d.fileName)}
                  >
                    Download
                  </button>
                  <button type="button" className="text-xs font-semibold text-red-700 hover:underline" onClick={() => void onDeleteDoc(d.id)}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
            {documents.length === 0 ? <li className="text-slate-500">No documents on file yet.</li> : null}
          </ul>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["WORK_PERMIT_CARD", "Work permit card"],
              ["NHI_CARD", "NHI card"],
              ["ID_CARD", "Government ID card"],
              ["CONTRACT", "Employment contract"],
              ["OTHER", "Other (misc)"]
            ].map(([t, label]) => (
              <label key={t} className="block text-xs">
                <span className="text-slate-600">{label}</span>
                <input
                  type="file"
                  className="mt-0.5 w-full text-xs"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      void onUpload(f, t);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Internal notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Delete employee
          </button>
        </div>
      </form>

      <ShareTrackerAccessCard employeeId={id} employeeName={fullName.trim() || "this employee"} />
    </div>
  );
}
