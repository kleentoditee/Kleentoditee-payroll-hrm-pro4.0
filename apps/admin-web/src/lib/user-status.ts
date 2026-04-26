export type UserStatusKey = "invited" | "active" | "suspended" | "deactivated";

const LABELS: Record<UserStatusKey, string> = {
  invited: "Invited",
  active: "Active",
  suspended: "Suspended",
  deactivated: "Deactivated"
};

const STYLES: Record<UserStatusKey, string> = {
  invited: "bg-amber-100 text-amber-900",
  active: "bg-emerald-100 text-emerald-900",
  suspended: "bg-orange-100 text-orange-900",
  deactivated: "bg-slate-200 text-slate-800"
};

export function userStatusLabel(s: string): string {
  if (s in LABELS) {
    return LABELS[s as UserStatusKey];
  }
  return s;
}

export function userStatusBadgeClass(s: string): string {
  if (s in STYLES) {
    return STYLES[s as UserStatusKey];
  }
  return "bg-slate-100 text-slate-800";
}
