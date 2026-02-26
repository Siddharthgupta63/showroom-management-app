// frontend/lib/auth.ts
import { api } from "./api";

// ✅ Your app mostly uses "token", so make it the primary key
export const TOKEN_KEY = "token";

export const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token") || localStorage.getItem("showroom_token");
};

export const setToken = (token: string) => {
  if (typeof window === "undefined") return;
  // ✅ write both to stay compatible
  localStorage.setItem("token", token);
  localStorage.setItem("showroom_token", token);
};

export const clearToken = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("showroom_token");
};

export const getUser = () => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user") || localStorage.getItem("showroom_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const logout = async () => {
  try {
    await api.post("/api/auth/logout");
  } catch {}
  clearToken();
  if (typeof window !== "undefined") window.location.href = "/login";
};
