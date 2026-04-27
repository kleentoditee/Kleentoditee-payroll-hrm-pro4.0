import type { Prisma } from "@kleentoditee/db";
import { type Employee, type EmployeeDocument, type Role } from "@kleentoditee/db";

/** For `TimeEntry` / payroll includes — never expose SSN, NHI, IRD, work permit, HR notes, or photo path. */
export const employeeForNestedTimeContextSelect = {
  id: true,
  fullName: true,
  role: true,
  defaultSite: true,
  phone: true,
  basePayType: true,
  dailyRate: true,
  hourlyRate: true,
  overtimeRate: true,
  fixedPay: true,
  standardDays: true,
  standardHours: true,
  paySchedule: true,
  active: true,
  templateId: true,
  createdAt: true,
  updatedAt: true
} as const satisfies Prisma.EmployeeSelect;

export const CAN_VIEW_EMPLOYEE_PII: readonly Role[] = [
  "platform_owner",
  "hr_admin",
  "payroll_admin"
] as const as unknown as readonly Role[];

export function canViewFullEmployeePii(roles: Role[]): boolean {
  return roles.some((r) => (CAN_VIEW_EMPLOYEE_PII as readonly string[]).includes(r as string));
}

/** Mask SSN/IRD/NHI style identifiers for list + non-HR views. */
export function maskIdentifier(value: string | null | undefined): string {
  if (value == null || value === "") {
    return "";
  }
  if (value.length <= 4) {
    return "****";
  }
  return "••••" + value.slice(-4);
}

const SENSITIVE_EMPLOYEE_STRING_FIELDS = [
  "socialSecurityNumber",
  "nationalHealthInsuranceNumber",
  "inlandRevenueDepartmentNumber",
  "workPermitNumber"
] as const;

/** Strip sensitive field values for audit logs (never log raw PII or file paths). */
export function redactEmployeeSnapshot(e: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (e == null) {
    return null;
  }
  const o = { ...e };
  for (const k of SENSITIVE_EMPLOYEE_STRING_FIELDS) {
    if (k in o && o[k] != null && String(o[k]) !== "") {
      o[k] = "[redacted]";
    }
  }
  if (o.profilePhotoPath) {
    o.profilePhotoPath = "[path redacted]";
  }
  if (e.notes && String(e.notes).length > 0) {
    o.notes = "[redacted: notes]";
  }
  return o;
}

type Template = { name: string; id?: string };
type ListLinked = { email: string; status: string } | null;

export type EmployeeListRow = {
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

export function toListEmployee(emp: Employee & { template: Template; linkedUser?: ListLinked }): EmployeeListRow {
  return {
    id: emp.id,
    fullName: emp.fullName,
    role: emp.role,
    defaultSite: emp.defaultSite,
    phone: emp.phone,
    active: emp.active,
    basePayType: emp.basePayType,
    paySchedule: emp.paySchedule,
    template: { name: emp.template.name },
    hasProfilePhoto: Boolean(emp.profilePhotoPath),
    linkedUser: emp.linkedUser ?? null
  };
}

export function documentDto(empId: string, d: EmployeeDocument): {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedByUserId: string | null;
  downloadUrl: string;
} {
  return {
    id: d.id,
    type: d.type,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    uploadedAt: d.uploadedAt.toISOString(),
    uploadedByUserId: d.uploadedByUserId,
    downloadUrl: `/people/employees/${empId}/documents/${d.id}/file`
  };
}

export function toDetailPayload(
  emp: Employee & { template: Template; documents: EmployeeDocument[]; linkedUser?: ListLinked },
  roles: Role[]
): Record<string, unknown> {
  const expose = canViewFullEmployeePii(roles);
  const activeDocs = emp.documents.filter((d) => d.deletedAt == null);
  return {
    id: emp.id,
    createdAt: emp.createdAt,
    updatedAt: emp.updatedAt,
    fullName: emp.fullName,
    role: emp.role,
    defaultSite: emp.defaultSite,
    phone: emp.phone,
    basePayType: emp.basePayType,
    dailyRate: emp.dailyRate,
    hourlyRate: emp.hourlyRate,
    overtimeRate: emp.overtimeRate,
    fixedPay: emp.fixedPay,
    standardDays: emp.standardDays,
    standardHours: emp.standardHours,
    paySchedule: emp.paySchedule,
    active: emp.active,
    notes: emp.notes,
    templateId: emp.templateId,
    template: emp.template,
    profilePhotoPath: emp.profilePhotoPath,
    profilePhotoViewUrl: `/people/employees/${emp.id}/profile-photo`,
    employmentStartDate: emp.employmentStartDate?.toISOString() ?? null,
    employmentEndDate: emp.employmentEndDate?.toISOString() ?? null,
    workPermitExpiryDate: emp.workPermitExpiryDate?.toISOString() ?? null,
    socialSecurityNumber: expose ? emp.socialSecurityNumber : maskIdentifier(emp.socialSecurityNumber),
    nationalHealthInsuranceNumber: expose ? emp.nationalHealthInsuranceNumber : maskIdentifier(emp.nationalHealthInsuranceNumber),
    inlandRevenueDepartmentNumber: expose ? emp.inlandRevenueDepartmentNumber : maskIdentifier(emp.inlandRevenueDepartmentNumber),
    workPermitNumber: expose ? emp.workPermitNumber : maskIdentifier(emp.workPermitNumber),
    sensitiveExposed: expose,
    hasProfilePhoto: Boolean(emp.profilePhotoPath),
    documents: activeDocs.map((d) => documentDto(emp.id, d)),
    linkedUser: emp.linkedUser ?? null
  };
}
