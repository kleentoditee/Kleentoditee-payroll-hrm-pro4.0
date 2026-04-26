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

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers
    }
  });
}
