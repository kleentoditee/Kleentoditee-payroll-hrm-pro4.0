import { getCsrfCookie } from "@/lib/auth-storage";

/**
 * API base for the employee tracker (port 3001). Same origin-proxy pattern as admin.
 * In local dev without NEXT_PUBLIC_API_URL, the browser uses /__kleentoditee_api (rewritten to :8787).
 */
export function apiBase(): string {
  const u = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (u) {
    return u;
  }
  if (typeof window !== "undefined") {
    const p = window.location.port;
    if (p === "3000" || p === "3001") {
      return "/__kleentoditee_api";
    }
  }
  return "/__kleentoditee_api";
}

/** Human-readable description of where API requests go (development diagnostics only). */
export function apiDiagnosticLabel(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (configured) {
    return `NEXT_PUBLIC_API_URL=${configured} (browser calls this origin directly; API must allow CORS from the tracker)`;
  }
  if (typeof window !== "undefined") {
    const { origin, port } = window.location;
    if (port === "3000" || port === "3001") {
      return `${origin}/__kleentoditee_api/* → dev proxy → http://127.0.0.1:8787/*`;
    }
  }
  if (process.env.NODE_ENV === "development") {
    return "/__kleentoditee_api/* (dev proxy) → http://127.0.0.1:8787/*";
  }
  return "/__kleentoditee_api/* (same-origin production proxy)";
}

export function logApiUnreachable(err: unknown): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  console.error(
    "[employee-tracker] Cannot reach the API.",
    "Target:",
    apiDiagnosticLabel(),
    "| Start the API on port 8787 (e.g. npm run dev:api), use the same DATABASE_URL as db:seed, and avoid a wrong NEXT_PUBLIC_API_URL in .env.",
    err
  );
}

export async function readApiJson<T>(res: Response): Promise<{ data: T | null; rawText: string }> {
  const rawText = await res.text();
  if (!rawText) {
    return { data: null, rawText: "" };
  }
  try {
    return { data: JSON.parse(rawText) as T, rawText };
  } catch {
    return { data: null, rawText: rawText.slice(0, 200) };
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers
    }
  });
}

/**
 * CSRF double-submit guard: mutating API requests automatically echo the
 * `kt_csrf` cookie in the `x-kt-csrf` header, which the API requires on
 * cookie-authenticated mutations. Idempotent — safe to call on every mount.
 */
export function installCsrfFetchGuard(): void {
  if (typeof window === "undefined") {
    return;
  }
  const w = window as unknown as { __ktCsrfGuard?: boolean };
  if (w.__ktCsrfGuard) {
    return;
  }
  w.__ktCsrfGuard = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const isApiCall = url.startsWith(apiBase()) || url.startsWith("/__kleentoditee_api");
    if (isApiCall && (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE")) {
      const csrf = getCsrfCookie();
      if (csrf) {
        const headers = new Headers(init?.headers);
        headers.set("x-kt-csrf", csrf);
        init = { ...init, headers };
      }
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;
}
