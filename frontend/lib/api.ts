
// frontend/lib/api.ts
import axios from "axios";

const baseURL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000";

export const api = axios.create({ baseURL });

function getToken() {
  if (typeof window === "undefined") return null;
  // ✅ support both keys (so old + new code works)
  return localStorage.getItem("token") || localStorage.getItem("showroom_token");
}

// ✅ attach token to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function kickToLogin(reason: string, message?: string) {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("showroom_token");
    if (message) localStorage.setItem("auth_popup_message", message);
    localStorage.setItem("auth_popup_reason", reason);
  } catch {}

  if (typeof window !== "undefined") {
    window.location.href = `/login?reason=${encodeURIComponent(reason)}`;
  }
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const code = error?.response?.data?.code;
    const msg =
      error?.response?.data?.message || "Session ended. Please login again.";

    if (status === 401 || status === 403) {
      if (code === "ACCOUNT_DISABLED" || code === "USER_DISABLED") {
        kickToLogin("disabled", msg);
      } else if (code === "PASSWORD_EXPIRED") {
        kickToLogin("password_expired", msg);
      } else if (code === "TOKEN_STALE") {
        kickToLogin("token_stale", msg);
      } else if (
        code === "INVALID_TOKEN" ||
        code === "NO_TOKEN" ||
        code === "TOKEN_REVOKED"
      ) {
        kickToLogin("invalid_token", msg);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

