"use client";

import { useEffect, useState } from "react";
import DASHBOARD_METRICS from "@/constants/dashboardMetrics";

interface DashboardData {
  [key: string]: number;
}

interface Permission {
  role: string;
  metric_key: string;
  is_visible: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({});
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [role, setRole] = useState<string>("");

  // -----------------------------
  // Hydration-safe token/year
  // -----------------------------
  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    setToken(localStorage.getItem("token"));
    setYear(new Date().getFullYear());
  }, []);

  /* ---------------- LOGOUT ---------------- */
  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  /* ---------------- AUTH GUARD ---------------- */
  useEffect(() => {
    // Avoid hydration mismatch: only redirect after mount.
    if (!mounted) return;

    if (!token) {
      window.location.href = "/login";
    }
  }, [token, mounted]);

  /* ---------------- GET ROLE FROM TOKEN ---------------- */
  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setRole(payload.role);
    } catch {
      handleLogout();
    }
  }, [token]);

  /* ---------------- FETCH DASHBOARD DATA ---------------- */
  useEffect(() => {
    if (!token) return;

    fetch("http://localhost:5000/api/reports/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setData);
  }, [token]);

  /* ---------------- FETCH PERMISSIONS ---------------- */
  useEffect(() => {
    if (!token) return;

    fetch("http://localhost:5000/api/admin/dashboard-permissions", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => setPermissions(json.data || []));
  }, [token]);

  /* ---------------- PERMISSION CHECK ---------------- */
  const hasPermission = (metricKey: string) => {
    if (role === "owner") return true;

    return permissions.some(
      (p) =>
        p.role === role &&
        p.metric_key === metricKey &&
        p.is_visible === 1
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ================= HEADER ================= */}
      <header className="bg-red-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-wide">
            GUPTA AUTO AGENCY
          </h1>
          <p className="text-sm opacity-90">
            Hero MotoCorp
          </p>
          <p className="text-xs opacity-80 mt-1">
            Logged in as: <strong>{role}</strong>
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="bg-white text-red-600 px-4 py-2 rounded font-semibold hover:bg-gray-100"
        >
          Logout
        </button>
      </header>

      {/* ================= DASHBOARD ================= */}
      <main className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {DASHBOARD_METRICS.filter((m) => hasPermission(m.key)).map(
            (metric) => (
              <div
                key={metric.key}
                className="bg-white rounded-xl shadow-md p-6 border-t-4 border-red-600"
              >
                <p className="text-gray-500 text-sm uppercase tracking-wide">
                  {metric.label}
                </p>
                <h2 className="text-3xl font-bold text-gray-900 mt-2">
                  {data[metric.key] ?? 0}
                </h2>
              </div>
            )
          )}
        </div>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="text-center text-sm text-gray-500 py-4">
        © {year ?? ""} GUPTA AUTO AGENCY · Hero MotoCorp Dealer
      </footer>
    </div>
  );
}
