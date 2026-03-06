"use client";

import React, { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";
import { api } from "@/lib/api";

function minutesAgo(ts: string | null) {
  if (!ts) return null;
  const d = new Date(ts);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
}

function statusFromMinutes(mins: number | null) {
  if (mins === null) return { label: "Never", color: "#777", bg: "#f2f2f2" };
  if (mins < 2) return { label: "Online", color: "#0a7a0a", bg: "#e8f8e8" };
  if (mins < 6) return { label: "Idle", color: "#b46300", bg: "#fff3e0" };
  return { label: "Offline", color: "#b00020", bg: "#fde7ea" };
}

export default function ActiveUsersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setLoading(true);

      const res = await api.get("/api/admin/active-users");
      setRows(res.data?.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load active users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // refresh every 15 seconds
    return () => clearInterval(t);
  }, []);

  const doForceLogout = async (u: any) => {
    const label = u?.username || u?.email || u?.name || `User #${u?.id}`;
    const ok = confirm(`Force logout for ${label}?\n\nThey will be logged out immediately.`);
    if (!ok) return;

    try {
      await api.post(`/api/admin/users/${u.id}/force-logout`);
      alert("User session revoked. They must login again.");
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to force logout");
    }
  };

  const decorated = useMemo(() => {
    return (rows || []).map((u) => {
      const mins = minutesAgo(u.last_active_at || null);
      const st = statusFromMinutes(mins);
      return { ...u, _mins: mins, _status: st };
    });
  }, [rows]);

  const counts = useMemo(() => {
    let online = 0,
      idle = 0,
      offline = 0,
      never = 0;

    for (const u of decorated) {
      if (u._mins === null) never++;
      else if (u._mins < 2) online++;
      else if (u._mins < 6) idle++;
      else offline++;
    }
    return { online, idle, offline, never, total: decorated.length };
  }, [decorated]);

  return (
    <AuthGuard roles={["owner", "admin"]}>
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Active Users</h1>
            <Link
              href="/admin/users"
              className="px-3 py-2 bg-white border border-gray-300 rounded text-sm"
            >
              ← Back to Users
            </Link>
          </div>

          <button
            onClick={load}
            className="px-4 py-2 bg-white border border-gray-300 rounded"
          >
            Refresh
          </button>
        </div>

        <p className="text-gray-600 mb-4">
          Online: &lt; 2 min • Idle: 2–6 min • Offline: &gt; 6 min
        </p>

        <div className="flex gap-2 flex-wrap mb-4">
          <div className="px-3 py-2 rounded bg-white border border-gray-200">
            <span className="font-semibold">Total:</span> {counts.total}
          </div>
          <div className="px-3 py-2 rounded bg-white border border-gray-200">
            <span className="font-semibold text-green-700">Online:</span>{" "}
            {counts.online}
          </div>
          <div className="px-3 py-2 rounded bg-white border border-gray-200">
            <span className="font-semibold text-orange-700">Idle:</span>{" "}
            {counts.idle}
          </div>
          <div className="px-3 py-2 rounded bg-white border border-gray-200">
            <span className="font-semibold text-red-700">Offline:</span>{" "}
            {counts.offline}
          </div>
          <div className="px-3 py-2 rounded bg-white border border-gray-200">
            <span className="font-semibold text-gray-700">Never:</span>{" "}
            {counts.never}
          </div>
        </div>

        {loading && <p>Loading...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto bg-white rounded shadow">
            <table className="w-full border-collapse">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-2 text-left">User</th>
                  <th className="p-2 text-left">Role</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Minutes Ago</th>
                  <th className="p-2 text-left">Last Active</th>
                  <th className="p-2 text-left">Enabled?</th>
                  <th className="p-2 text-left">Action</th>
                </tr>
              </thead>

              <tbody>
                {decorated.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">
                      <div className="font-semibold">
                        {u.name || u.username || u.email || `User #${u.id}`}
                      </div>
                      <div className="text-xs text-gray-600">
                        {u.username ? `@${u.username}` : ""}
                        {u.email ? ` • ${u.email}` : ""}
                        {u.mobile ? ` • ${u.mobile}` : ""}
                      </div>
                    </td>

                    <td className="p-2 capitalize">{u.role}</td>

                    <td className="p-2">
                      <span
                        style={{
                          background: u._status.bg,
                          color: u._status.color,
                          border: "1px solid rgba(0,0,0,0.08)",
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontWeight: 700,
                          fontSize: 12,
                          display: "inline-block",
                        }}
                      >
                        {u._status.label}
                      </span>
                    </td>

                    <td className="p-2">{u._mins === null ? "-" : `${u._mins} min`}</td>

                    <td className="p-2">{u.last_active_at || "-"}</td>

                    <td className="p-2">
                      {Number(u.is_active) === 1 ? (
                        <span className="text-green-700 font-semibold">Yes</span>
                      ) : (
                        <span className="text-red-700 font-semibold">No</span>
                      )}
                    </td>

                    <td className="p-2">
                      <button
                        onClick={() => doForceLogout(u)}
                        className="px-3 py-1 rounded text-white bg-red-600"
                        title="Revoke user token (force logout)"
                      >
                        Force Logout
                      </button>
                    </td>
                  </tr>
                ))}

                {decorated.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-3 text-gray-600">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
