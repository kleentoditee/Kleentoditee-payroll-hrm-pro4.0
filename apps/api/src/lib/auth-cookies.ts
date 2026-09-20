import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Server-managed session cookies.
 * - `kt_session` carries the JWT, HttpOnly so browser scripts cannot read it.
 * - `kt_csrf` is readable by scripts and must be echoed back in the
 *   `x-kt-csrf` header on mutating requests (double-submit defense).
 * Bearer tokens in the Authorization header remain accepted as a
 * transitional compatibility path, but new sign-ins only receive cookies.
 */

export const SESSION_COOKIE = "kt_session";
export const CSRF_COOKIE = "kt_csrf";
export const CSRF_HEADER = "x-kt-csrf";
export const SESSION_TTL_SEC = 60 * 60 * 12;

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) {
    return out;
  }
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) {
      continue;
    }
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) {
      out[name] = decodeURIComponent(value);
    }
  }
  return out;
}

function cookieBase(name: string, value: string, maxAgeSec: number, secure: boolean): string {
  const attrs = [`${name}=${encodeURIComponent(value)}`, "Path=/", "SameSite=Lax", `Max-Age=${maxAgeSec}`];
  if (secure) {
    attrs.push("Secure");
  }
  return attrs.join("; ");
}

export function sessionCookieValue(token: string, secure: boolean): string {
  return `${cookieBase(SESSION_COOKIE, token, SESSION_TTL_SEC, secure)}; HttpOnly`;
}

export function csrfCookieValue(csrfToken: string, secure: boolean): string {
  return cookieBase(CSRF_COOKIE, csrfToken, SESSION_TTL_SEC, secure);
}

export function expiredCookieValue(name: string, httpOnly: boolean): string {
  const attrs = [`${name}=`, "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (httpOnly) {
    attrs.push("HttpOnly");
  }
  return attrs.join("; ");
}

export function newCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function csrfTokensMatch(headerValue: string, cookieValue: string): boolean {
  const a = Buffer.from(headerValue);
  const b = Buffer.from(cookieValue);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Mutating HTTP methods that require CSRF validation on cookie-authed requests. */
export function isMutatingMethod(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}
