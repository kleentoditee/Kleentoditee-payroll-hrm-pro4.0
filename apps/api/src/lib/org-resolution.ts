/**
 * Pure organization-selection logic (Batch 12). Given the caller's requested
 * org (header/cookie) and their memberships, decide which tenant scope the
 * request runs in. No client-supplied org id is ever trusted without a
 * membership row; platform-support access is explicit and flagged so the
 * caller can audit it.
 */

export const ORG_HEADER = "x-kt-org";
export const ORG_COOKIE = "kt_org";

export interface OrgMembershipInfo {
  orgId: string;
  orgName: string;
  orgSlug: string;
  orgStatus: "active" | "suspended";
}

export type OrgResolution =
  | { kind: "ok"; orgId: string; supportAccess: boolean }
  | { kind: "none" }
  | { kind: "ambiguous"; orgs: OrgMembershipInfo[] }
  | { kind: "forbidden"; reason: string }
  | { kind: "unknown_org"; orgId: string };

export function resolveOrgSelection(input: {
  requestedOrgId: string | null;
  memberships: OrgMembershipInfo[];
  isPlatformSupport: boolean;
  /** Only consulted when support staff request an org they are not a member of. */
  supportOrgExists?: boolean;
}): OrgResolution {
  const requested = input.requestedOrgId?.trim() || null;

  if (requested) {
    const membership = input.memberships.find((m) => m.orgId === requested);
    if (membership) {
      if (membership.orgStatus !== "active") {
        return { kind: "forbidden", reason: "This organization is suspended." };
      }
      return { kind: "ok", orgId: requested, supportAccess: false };
    }
    if (input.isPlatformSupport) {
      // Support may enter an org they are not a member of; the caller audits it.
      return input.supportOrgExists
        ? { kind: "ok", orgId: requested, supportAccess: true }
        : { kind: "unknown_org", orgId: requested };
    }
    // Uniform denial: do not reveal whether the org exists.
    return { kind: "forbidden", reason: "You are not a member of this organization." };
  }

  if (input.memberships.length === 0) {
    return { kind: "none" };
  }
  const active = input.memberships.filter((m) => m.orgStatus === "active");
  if (active.length === 1) {
    return { kind: "ok", orgId: active[0].orgId, supportAccess: false };
  }
  if (active.length === 0) {
    return { kind: "forbidden", reason: "This organization is suspended." };
  }
  return { kind: "ambiguous", orgs: active };
}
