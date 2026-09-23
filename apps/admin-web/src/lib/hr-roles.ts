/** Roles that may store and view unmasked SSN, NHI, IRD, and work permit data (matches API). */
const PII_ROLES = new Set(["platform_owner", "hr_admin", "payroll_admin"]);

export function canViewEmployeePii(roles: string[] | undefined): boolean {
  return roles != null && roles.some((r) => PII_ROLES.has(r));
}
