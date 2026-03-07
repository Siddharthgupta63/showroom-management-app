"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DASHBOARD_METRICS from "@/constants/dashboardMetrics";
import api from "@/lib/api";

interface DashboardData {
  [key: string]: number;
}

type CardLinkMap = {
  [key: string]: string;
};

const CARD_LINKS: CardLinkMap = {
  total_sales: "/sales",
  pending_insurance: "/insurance?status=pending",
  pending_rc: "/rc?status=pending",
  pending_hsrp: "/hsrp?status=pending",
  pending_vahan: "/vahan?status=pending",
  renewals_due: "/insurance/renewals?status=due",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({});
  const [role, setRole] = useState<string>("");

  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    setToken(localStorage.getItem("token") || localStorage.getItem("showroom_token"));
    setYear(new Date().getFullYear());
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("showroom_token");
    window.location.href = "/login";
  };

  useEffect(() => {
    if (!mounted) return;
    if (!token) {
      window.location.href = "/login";
    }
  }, [token, mounted]);

  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setRole(String(payload.role || ""));
    } catch {
      handleLogout();
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;

    api
      .get("/api/reports/dashboard")
      .then((res) => setData(res.data || {}))
      .catch((err) => {
        console.error("Dashboard metrics fetch failed:", err);
        setData({});
      });
  }, [token]);

  const visibleMetrics = DASHBOARD_METRICS.filter((metric) =>
    Object.prototype.hasOwnProperty.call(data, metric.key)
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-red-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-wide">GUPTA AUTO AGENCY</h1>
          <p className="text-sm opacity-90">Hero MotoCorp</p>
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

      <main className="p-6">
        {visibleMetrics.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-6 text-gray-600">
            No dashboard metrics available for this role.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleMetrics.map((metric) => {
              const href = CARD_LINKS[metric.key];

              const card = (
                <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-red-600 transition hover:shadow-lg">
                  <p className="text-gray-500 text-sm uppercase tracking-wide">
                    {metric.label}
                  </p>
                  <h2 className="text-3xl font-bold text-gray-900 mt-2">
                    {data[metric.key] ?? 0}
                  </h2>
                  {href ? (
                    <p className="text-xs text-blue-600 mt-3 font-medium">
                      Click to open
                    </p>
                  ) : null}
                </div>
              );

              if (!href) {
                return <div key={metric.key}>{card}</div>;
              }

              return (
                <Link key={metric.key} href={href} className="block">
                  {card}
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <footer className="text-center text-sm text-gray-500 py-4">
        © {year ?? ""} GUPTA AUTO AGENCY · Hero MotoCorp Dealer
      </footer>
    </div>
  );
}