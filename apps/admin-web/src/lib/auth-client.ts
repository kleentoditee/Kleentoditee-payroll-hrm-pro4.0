import { apiFetch, authenticatedFetch, isAuthFailure, readApiData } from "@/lib/api";
import { clearToken, getToken, setToken } from "@/lib/auth-storage";

export type AdminUser = { id: string; email: string; name: string; roles: string[] };
export type LoginResponse = { token?: string; error?: string };

export function storeLoginResponse(data: LoginResponse): boolean {
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

export async function devEmergencyLogin(): Promise<Response> {
  return apiFetch("/auth/dev-emergency", { method: "POST" });
}

export async function fetchCurrentUser(): Promise<AdminUser> {
  const res = await authenticatedFetch("/auth/me");
  if (isAuthFailure(res)) {
    clearToken();
  }
  return readApiData<{ user: AdminUser }>(res, "Unable to load current user").then((data) => data.user);
}

export function logout(): void {
  clearToken();
}
