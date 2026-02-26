"use client";

import React, { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";
import { api } from "@/lib/api";

export default function AccessWindowPage() {
  const [enabled, setEnabled] = useState(true);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("20:00");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.get("/api/admin/access-window");
      const s = res.data?.data || {};

      setEnabled(Number(s.staff_access_enabled) === 1);
      setStart(String(s.staff_access_start || "08:00:00").slice(0, 5));
      setEnd(String(s.staff_access_end || "20:00:00").slice(0, 5));
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load access window settings");
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

    try {
      await api.post("/api/admin/access-window", {
        enabled,
        start,
        end,
      });

      alert("Saved successfully");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard roles={["owner"]}>
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Staff Access Time</h1>

            <Link
              href="/admin/users"
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

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="bg-white rounded shadow p-4 max-w-xl">
            {error && (
              <div className="mb-3 p-3 rounded bg-red-50 border border-red-200 text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <input
                id="enabled"
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <label htmlFor="enabled" className="font-semibold">
                Enable staff time restriction
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  disabled={!enabled}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  disabled={!enabled}
                />
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-700">
              <p className="mb-1">
                ✅ <b>Owner/Admin</b> can access anytime.
              </p>
              <p className="mb-1">
                ✅ All other roles (sales, insurance, vahan, hsrp, renewal, rc,
                manager) are restricted by this window.
              </p>
              <p className="mb-1">
                ✅ Supports overnight windows too (example: <b>20:00 → 08:00</b>).
              </p>
              <p className="text-gray-500 mt-2">
                Note: If enabled and staff is outside allowed time, backend returns{" "}
                <b>ACCESS_TIME_BLOCKED</b>.
              </p>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
