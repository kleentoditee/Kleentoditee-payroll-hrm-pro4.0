import { authHeaders } from "@/lib/auth-storage";

/**
 * API base for the employee tracker (port 3001). Same origin-proxy pattern as admin.
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
  if (process.env.NODE_ENV === "development") {
    return "/__kleentoditee_api";
  }
  return "http://127.0.0.1:8787";
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

function mergeHeaders(...headersList: Array<HeadersInit | undefined>): HeadersInit {
  const headers = new Headers();
  for (const headerSet of headersList) {
    if (!headerSet) {
      continue;
    }
    new Headers(headerSet).forEach((value, key) => headers.set(key, value));
  }
  return headers;
}

function jsonHeaders(init: RequestInit): HeadersInit | undefined {
  if (!init.body || init.body instanceof FormData || new Headers(init.headers).has("Content-Type")) {
    return undefined;
  }
  return { "Content-Type": "application/json" };
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: mergeHeaders(jsonHeaders(init), init.headers)
  });
}

export async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: mergeHeaders(jsonHeaders(init), authHeaders(), init.headers)
  });
}

export function isAuthFailure(res: Response): boolean {
  return res.status === 401 || res.status === 403;
}
