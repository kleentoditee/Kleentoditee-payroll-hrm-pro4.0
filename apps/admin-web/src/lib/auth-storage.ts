const TOKEN_KEY = "kleentoditee_admin_token";
const COOKIE_SESSION_SENTINEL = "__kt_cookie_session__";

/**
 * Session model: the API now issues an HttpOnly `kt_session` cookie at
 * sign-in, so bearer tokens are no longer stored in browser storage (XSS-safe).
 *
 * getToken() is kept for transitional page guards: it returns a legacy stored
 * token when one exists, otherwise a non-null sentinel while the cookie
 * session is present (detected via the readable kt_csrf companion cookie). It must NOT be used as an Authorization value —
 * authHeaders() only sends a stored legacy token, never the sentinel.
 */

export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const sessionToken = window.sessionStorage.getItem(TOKEN_KEY);
  if (sessionToken) return sessionToken;
  const legacyToken = window.localStorage.getItem(TOKEN_KEY);
  if (legacyToken) {
    window.sessionStorage.setItem(TOKEN_KEY, legacyToken);
    window.localStorage.removeItem(TOKEN_KEY);
  }
  if (legacyToken) return legacyToken;
  return hasSessionCookie() ? COOKIE_SESSION_SENTINEL : null;
}

function hasSessionCookie(): boolean {
  // kt_session is HttpOnly (invisible to document.cookie); kt_csrf shares its
  // lifetime (set at sign-in, expired at logout, same TTL) and is readable.
  // If kt_csrf is stale while kt_session is gone, API calls 401 and pages redirect.
  return document.cookie.split(";").some((part) => part.split("=")[0]?.trim() === "kt_csrf");
}

/** No-op: the session lives in the HttpOnly cookie, not in storage. */
export function setToken(_token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
}

export function clearToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(): HeadersInit {
  const token =
    typeof window === "undefined"
      ? null
      : (window.sessionStorage.getItem(TOKEN_KEY) ?? window.localStorage.getItem(TOKEN_KEY));
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Read the CSRF double-submit cookie set at sign-in (readable, not HttpOnly). */
export function getCsrfCookie(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  for (const part of document.cookie.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === "kt_csrf") {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}
