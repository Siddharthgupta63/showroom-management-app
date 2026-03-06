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

  // 1️⃣ Try stored user first
  const raw = localStorage.getItem("user") || localStorage.getItem("showroom_user");
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {}
  }

  // 2️⃣ Fallback: decode token
  const token = getToken();
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );

    return decoded?.user || decoded || null;
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
