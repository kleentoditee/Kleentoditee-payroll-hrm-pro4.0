/**
 * Base URL for API calls from the admin web app.
 * - If `NEXT_PUBLIC_API_URL` is set (e.g. production or explicit dev), that URL is used.
 * - In `next dev` when unset, use a same-origin path so `next.config` rewrites to :8787 (no CORS).
 * - In production when unset, fall back to direct :8787 (set NEXT_PUBLIC in real deploys).
 */
export function apiBase(): string {
  const u = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (u) {
    return u;
  }
  // In the browser, prefer the same-origin proxy whenever the admin is the usual port (avoids relying only on NODE_ENV).
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

/** Read body once: avoids throw when the server returns HTML (e.g. 502) instead of JSON. */
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

export async function readApiData<T>(
  res: Response,
  fallback = res.statusText
): Promise<T> {
  const { data, rawText } = await readApiJson<T>(res);
  if (!res.ok) {
    const error =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: unknown }).error ?? "")
        : "";
    throw new Error(error || rawText || fallback || `HTTP ${res.status}`);
  }
  if (!data) {
    throw new Error(rawText || fallback || "Empty API response");
  }
  return data;
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
