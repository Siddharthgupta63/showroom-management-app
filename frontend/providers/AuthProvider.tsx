
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

// Match your existing hardcoded backend base URL used across pages.
const API_BASE = "http://localhost:5000";

type User = {
  id: number;
  email: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Popup state for forced logout reasons (password expired / disabled / token revoked)
  const [forcedReason, setForcedReason] = useState<{
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }

    setLoading(false);
  }, []);

  // ---- Global auth error handler (works even if pages use raw fetch) ----
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Avoid double-wrapping fetch during Fast Refresh
    const w = window as any;
    if (w.__authFetchWrapped) return;
    w.__authFetchWrapped = true;

const originalFetch: typeof fetch = w.fetch.bind(window);

w.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const resp: Response = await originalFetch(input, init);


      if (resp.status === 401 || resp.status === 403) {
        try {
          const ct = resp.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const cloned = resp.clone();
            const data = await cloned.json();
            const code = data?.code;

            if (code === "PASSWORD_EXPIRED") {
              setForcedReason({
                title: "Password Expired",
                message:
                  "Your password has expired (30 days). Please contact owner/admin to reset it.",
              });
            } else if (code === "USER_DISABLED") {
              setForcedReason({
                title: "Account Disabled",
                message: "Your account has been disabled. Please contact owner/admin.",
              });
            } else if (code === "TOKEN_REVOKED") {
              setForcedReason({
                title: "Session Expired",
                message: "Your session was revoked. Please login again.",
              });
            }
          }
        } catch {
          // ignore parse errors (file downloads / non-json)
        }
      }

      return resp;
    };
  }, []);

  // ---- Session heartbeat (updates users.last_active_at) ----
  useEffect(() => {
    if (!token) return;

    let stopped = false;

    const ping = async () => {
      if (stopped) return;
      try {
        await fetch(`${API_BASE}/api/auth/heartbeat`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    };

    ping();
    const t = setInterval(ping, 45 * 1000);

    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  const closeForcedPopup = () => {
    setForcedReason(null);
    logout();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}

      {forcedReason && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: "min(520px, 92vw)",
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ margin: 0 }}>{forcedReason.title}</h3>
            <p style={{ marginTop: 10, lineHeight: 1.5 }}>
              {forcedReason.message}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={closeForcedPopup} style={{ padding: "8px 14px" }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}


export const useAuthContext = useAuth;
