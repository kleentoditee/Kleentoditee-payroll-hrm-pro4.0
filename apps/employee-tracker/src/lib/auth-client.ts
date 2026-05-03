import { apiFetch, authenticatedFetch, isAuthFailure, readApiJson } from "@/lib/api";
import { clearToken, getToken, setToken } from "@/lib/auth-storage";

export type TrackerLoginResponse = { token?: string; error?: string };
export type TrackerProfileResponse = {
  employee?: { fullName: string; defaultSite: string; paySchedule: string };
  error?: string;
};

export function storeLoginResponse(data: TrackerLoginResponse): boolean {
  if (!data.token) {
    return false;
  }
  setToken(data.token);
  return true;
}

export async function loginWithPassword(email: string, password: string): Promise<Response> {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function fetchTrackerProfile(): Promise<Response> {
  const res = await authenticatedFetch("/time/self/profile");
  if (isAuthFailure(res)) {
    clearToken();
  }
  return res;
}

export function logout(): void {
  clearToken();
}

export { authenticatedFetch };
