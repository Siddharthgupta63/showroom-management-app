"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DASHBOARD_METRICS from "@/constants/dashboardMetrics";
import api from "@/lib/api";
import FestivalLoginOverlay from "@/components/FestivalLoginOverlay";

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
  pending_vahan_fill: "/vahan?tab=pending_fill",
  pending_vahan_payment: "/vahan?tab=pending_payment",
  renewals_due: "/insurance/renewals?status=due",
};

type NoticeData = {
  dashboard_notice_enabled: number;
  dashboard_notice_text: string;
};

type FestivalConfig = {
  login_effect_enabled: number;
  login_effect_type: string;
  login_effect_duration_sec: number;
  login_effect_message: string;
};

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function formatTodayDate() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({});
  const [role, setRole] = useState<string>("");
  const [userName, setUserName] = useState<string>("User");
  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState<number | null>(null);

  const [notice, setNotice] = useState<NoticeData>({
    dashboard_notice_enabled: 1,
    dashboard_notice_text: "",
  });

  const [showFestivalOverlay, setShowFestivalOverlay] = useState(false);
  const [festivalConfig, setFestivalConfig] = useState<FestivalConfig>({
    login_effect_enabled: 0,
    login_effect_type: "none",
    login_effect_duration_sec: 5,
    login_effect_message: "",
  });

  useEffect(() => {
    setMounted(true);
    setToken(localStorage.getItem("token") || localStorage.getItem("showroom_token"));
    setYear(new Date().getFullYear());

    try {
      const userRaw = localStorage.getItem("user");
      if (userRaw) {
        const user = JSON.parse(userRaw);
        setUserName(
          String(
            user?.username ||
              user?.name ||
              user?.full_name ||
              user?.mobile_number ||
              "User"
          )
        );
      }
    } catch {}
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("showroom_token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("show_festival_effect");
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
  .get("/api/dashboard")
  .then((res) => setData(res.data?.data || {}))
      .catch((err) => {
        console.error("Dashboard metrics fetch failed:", err);
        setData({});
      });

    api
      .get("/api/admin/dashboard-notice")
      .then((res) => {
        const noticeData =
          res.data?.data || {
            dashboard_notice_enabled: 1,
            dashboard_notice_text: "",
            login_effect_enabled: 0,
            login_effect_type: "none",
            login_effect_duration_sec: 5,
            login_effect_message: "",
          };

        setNotice({
          dashboard_notice_enabled:
            Number(noticeData.dashboard_notice_enabled) === 1 ? 1 : 0,
          dashboard_notice_text: String(noticeData.dashboard_notice_text || ""),
        });

        setFestivalConfig({
          login_effect_enabled:
            Number(noticeData.login_effect_enabled) === 1 ? 1 : 0,
          login_effect_type: String(noticeData.login_effect_type || "none"),
          login_effect_duration_sec:
            Number(noticeData.login_effect_duration_sec) || 5,
          login_effect_message: String(noticeData.login_effect_message || ""),
        });

        const shouldShowFestival =
          sessionStorage.getItem("show_festival_effect") === "1" &&
          Number(noticeData.login_effect_enabled) === 1 &&
          String(noticeData.login_effect_type || "none") !== "none";

        if (shouldShowFestival) {
          setShowFestivalOverlay(true);
          sessionStorage.removeItem("show_festival_effect");
        }
      })
      .catch((err) => {
        console.error("Dashboard notice fetch failed:", err);
      });
  }, [token]);

  const visibleMetrics = DASHBOARD_METRICS.filter((metric) =>
    Object.prototype.hasOwnProperty.call(data, metric.key)
  );

  const noticeText = useMemo(() => {
    const base = `${getGreeting()}, ${userName} — ${formatTodayDate()}`;
    const custom = String(notice.dashboard_notice_text || "").trim();

    if (Number(notice.dashboard_notice_enabled) !== 1) {
      return base;
    }

    if (!custom) {
      return base;
    }

    return `${base} | ${custom}`;
  }, [notice, userName]);

  return (
    <div className="min-h-screen bg-gray-100">
      <FestivalLoginOverlay
        open={showFestivalOverlay}
        durationSec={festivalConfig.login_effect_duration_sec}
        message={festivalConfig.login_effect_message || "🎆 Welcome"}
        type={festivalConfig.login_effect_type}
        onDone={() => setShowFestivalOverlay(false)}
      />

      <header className="bg-red-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-wide">GUPTA AUTO AGENCY</h1>
          <p className="text-sm opacity-90">Hero MotoCorp</p>
          <p className="text-xs opacity-80 mt-1">
            Logged in as: <strong>{role}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(role || "").toLowerCase() === "owner" ||
          (role || "").toLowerCase() === "admin" ? (
            <Link
              href="/admin/dashboard-notice"
              className="bg-white/15 border border-white/30 text-white px-4 py-2 rounded font-medium hover:bg-white/20"
            >
              Notice Settings
            </Link>
          ) : null}

          <button
            onClick={handleLogout}
            className="bg-white text-red-600 px-4 py-2 rounded font-semibold hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="p-6">
        <div className="mb-6 overflow-hidden rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md">
          <div
            className="px-4 py-3 whitespace-nowrap inline-block font-medium"
            style={{
              animation: "dashboardMarquee 18s linear infinite",
              paddingLeft: "100%",
            }}
          >
            {noticeText}
          </div>
        </div>

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

      <style jsx>{`
        @keyframes dashboardMarquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </div>
  );
}