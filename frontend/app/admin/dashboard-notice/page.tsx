"use client";

import React, { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";
import { api } from "@/lib/api";

export default function DashboardNoticePage() {
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState("");

  const [loginEffectEnabled, setLoginEffectEnabled] = useState(false);
  const [loginEffectType, setLoginEffectType] = useState("diwali");
  const [loginEffectDurationSec, setLoginEffectDurationSec] = useState(5);
  const [loginEffectMessage, setLoginEffectMessage] = useState("🎆 Happy Diwali");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const res = await api.get("/api/admin/dashboard-notice");
      const data = res.data?.data || {};

      setEnabled(Number(data.dashboard_notice_enabled) === 1);
      setMessage(String(data.dashboard_notice_text || ""));
      setLoginEffectEnabled(Number(data.login_effect_enabled) === 1);
      setLoginEffectType(String(data.login_effect_type || "diwali"));
      setLoginEffectDurationSec(Number(data.login_effect_duration_sec) || 5);
      setLoginEffectMessage(String(data.login_effect_message || "🎆 Happy Diwali"));
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load dashboard notice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      await api.post("/api/admin/dashboard-notice", {
        enabled,
        message,
        login_effect_enabled: loginEffectEnabled,
        login_effect_type: loginEffectType,
        login_effect_duration_sec: loginEffectDurationSec,
        login_effect_message: loginEffectMessage,
      });

      setStatusMessage("Dashboard notice and festival login effect saved successfully");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard roles={["owner", "admin"]}>
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Notice Bar</h1>
            <Link
              href="/dashboard"
              className="px-3 py-2 bg-white border border-gray-300 rounded text-sm"
            >
              ← Back
            </Link>
          </div>

          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading || saving}
              className="px-4 py-2 bg-white border border-gray-300 rounded"
            >
              Refresh
            </button>

            <button
              onClick={save}
              disabled={loading || saving}
              className="px-4 py-2 rounded bg-blue-600 text-white"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5 max-w-4xl">
          {loading ? (
            <p className="text-gray-600">Loading...</p>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-red-700">
                  {error}
                </div>
              )}

              {statusMessage && (
                <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-green-700">
                  {statusMessage}
                </div>
              )}

              <div className="flex items-center gap-2 mb-5">
                <input
                  id="enabled"
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <label htmlFor="enabled" className="font-semibold text-gray-800">
                  Enable dashboard notice bar
                </label>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notice Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Example: Happy New Year to all team members. Please complete pending RC files today."
                />
                <p className="text-xs text-gray-500 mt-1">Maximum 500 characters</p>
              </div>

              <div className="rounded-lg border bg-gray-50 p-4 mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-2">Notice Preview</p>
                <div className="rounded-lg bg-red-600 text-white px-4 py-3 overflow-hidden">
                  <div
                    className="whitespace-nowrap inline-block"
                    style={{
                      animation: "dashboardMarquee 18s linear infinite",
                      paddingLeft: "100%",
                    }}
                  >
                    Good Morning — Friday, 20 March 2026 | {message || "Welcome to dashboard"}
                  </div>
                </div>
              </div>

              <div className="border-t pt-5">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Festival Login Effect
                </h2>

                <div className="flex items-center gap-2 mb-4">
                  <input
                    id="loginEffectEnabled"
                    type="checkbox"
                    checked={loginEffectEnabled}
                    onChange={(e) => setLoginEffectEnabled(e.target.checked)}
                  />
                  <label htmlFor="loginEffectEnabled" className="font-semibold text-gray-800">
                    Enable festival effect after login
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Effect Type
                    </label>
                    <select
  value={loginEffectType}
  onChange={(e) => setLoginEffectType(e.target.value)}
  className="w-full border rounded-lg px-3 py-2"
>
  <option value="diwali">Diwali Firecracker</option>
  <option value="navratri">Navratri Celebration</option>
  <option value="new_year">New Year Celebration</option>
  <option value="christmas">Christmas Snow</option>
  <option value="holi">Holi Colors</option>
  <option value="independence_day">Independence Day</option>
  <option value="none">None</option>
</select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (seconds)
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={10}
                      value={loginEffectDurationSec}
                      onChange={(e) =>
                        setLoginEffectDurationSec(
                          Math.min(10, Math.max(3, Number(e.target.value || 5)))
                        )
                      }
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Festival Message
                    </label>
                    <input
                      type="text"
                      value={loginEffectMessage}
                      onChange={(e) => setLoginEffectMessage(e.target.value.slice(0, 255))}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="🎆 Happy Diwali"
                    />
                  </div>
                </div>

                <div className="rounded-lg border bg-amber-50 p-3 text-sm text-amber-800">
                  This effect appears once after login for all employees when enabled by owner/admin.
                </div>
              </div>

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
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}