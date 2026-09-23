export const STAFF_REQUEST_TYPES = [
  "JOB_LETTER",
  "TIME_OFF",
  "SICK_LEAVE",
  "PROFILE_UPDATE",
  "SUPPLIES_REQUEST",
  "EQUIPMENT_UNIFORM_REQUEST",
  "INCIDENT_REPORT",
  "DAMAGE_REPORT"
] as const;
export type StaffRequestType = (typeof STAFF_REQUEST_TYPES)[number];

export const STAFF_REQUEST_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "DENIED",
  "COMPLETED",
  "CANCELLED"
] as const;
export type StaffRequestStatus = (typeof STAFF_REQUEST_STATUSES)[number];

export const REQUEST_TYPE_LABELS: Record<StaffRequestType, string> = {
  JOB_LETTER: "Job letter",
  TIME_OFF: "Time off",
  SICK_LEAVE: "Sick leave",
  PROFILE_UPDATE: "Profile update",
  SUPPLIES_REQUEST: "Supplies request",
  EQUIPMENT_UNIFORM_REQUEST: "Equipment / uniform",
  INCIDENT_REPORT: "Incident report",
  DAMAGE_REPORT: "Damage report"
};

export const REQUEST_STATUS_LABELS: Record<StaffRequestStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  DENIED: "Denied",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled"
};

export const STATUS_BADGE_CLASS: Record<StaffRequestStatus, string> = {
  SUBMITTED: "bg-amber-100 text-amber-900",
  UNDER_REVIEW: "bg-sky-100 text-sky-900",
  APPROVED: "bg-emerald-100 text-emerald-900",
  DENIED: "bg-rose-100 text-rose-900",
  COMPLETED: "bg-slate-200 text-slate-800",
  CANCELLED: "bg-slate-100 text-slate-600"
};

export type StaffRequest = {
  id: string;
  employeeId: string;
  type: StaffRequestType;
  status: StaffRequestStatus;
  subject: string | null;
  startDate: string | null;
  endDate: string | null;
  reason: string | null;
  details: string | null;
  requestedContactUpdate: Record<string, string> | null;
  reviewNote: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { id: string; fullName: string; defaultSite: string; role: string } | null;
  reviewedBy?: { id: string; name: string; email: string } | null;
};

const TRANSITIONS: Record<StaffRequestStatus, StaffRequestStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "APPROVED", "DENIED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "DENIED", "COMPLETED", "CANCELLED"],
  APPROVED: ["COMPLETED", "CANCELLED"],
  DENIED: [],
  COMPLETED: [],
  CANCELLED: []
};

export function allowedNextStatuses(current: StaffRequestStatus): StaffRequestStatus[] {
  return TRANSITIONS[current];
}
