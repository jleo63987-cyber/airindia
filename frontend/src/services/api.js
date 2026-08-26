import { requireSupabase } from "../lib/supabase";

export const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/$/, "");
export const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api$/, "");

async function accessToken() {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("You are not signed in.");
  return token;
}

export async function apiRequest(path, options = {}) {
  const token = await accessToken();
  const isFormData = options.body instanceof FormData;
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (!isFormData && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body:
      options.body === undefined || isFormData || typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body),
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `API request failed (${response.status}).`);
    error.status = response.status;
    error.details = payload?.error?.details;
    throw error;
  }

  return payload.data;
}

export async function currentAccessToken() {
  return accessToken();
}
