"use client";

import React, { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import Link from "next/link";

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reset Password Modal
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function loadUsers() {
    try {
      setError(null);
      setLoading(true);
      const res = await api.get("/api/admin/users");
      setUsers(res.data?.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Unable to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function toggleActive(u: any) {
    const next = !u.is_active;
    const label = u.username || u.email || u.name || `User #${u.id}`;

    const ok = confirm(
      `Are you sure you want to ${next ? "ENABLE" : "DISABLE"} this user?\n\n${label}`
    );
    if (!ok) return;

    try {
      await api.patch(`/api/admin/users/${u.id}/active`, { is_active: next });
      await loadUsers();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to update status");
    }
  }

  const openReset = (u: any) => {
    setResetUser(u);
    setNewPassword("");
    setResetOpen(true);
  };

  const closeReset = () => {
    setResetOpen(false);
    setResetUser(null);
    setNewPassword("");
  };

  const doResetPassword = async () => {
    if (!resetUser?.id) return;

    if (!newPassword || newPassword.trim().length < 4) {
      alert("Password must be at least 4 characters");
      return;
    }

    const label = resetUser.username || resetUser.email || resetUser.name || `User #${resetUser.id}`;
    const ok = confirm(
      `Reset password for:\n${label}\n\nUser will be forced to login again.`
    );
    if (!ok) return;

    try {
      setResetLoading(true);
      await api.post(`/api/admin/users/${resetUser.id}/reset-password`, {
        newPassword,
      });

      alert("Password reset successfully. User will be forced to login again.");
      closeReset();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  };

  const sortedUsers = useMemo(() => {
    // Active first, then newest
    return [...users].sort((a, b) => {
      const aa = Number(a.is_active) === 1 ? 1 : 0;
      const bb = Number(b.is_active) === 1 ? 1 : 0;
      if (bb !== aa) return bb - aa;
      return Number(b.id) - Number(a.id);
    });
  }, [users]);

  return (
    <AuthGuard roles={["owner", "admin"]}>
      <div className="p-6 bg-gray-100 min-h-screen">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold">Users</h1>

            <Link
              href="/admin/active-users"
              className="px-3 py-2 bg-white border border-gray-300 rounded text-sm"
              title="View online/idle/offline users"
            >
              Active Users Dashboard
            </Link>

            <Link
              href="/admin/access-window"
              className="px-3 py-2 bg-white border border-gray-300 rounded text-sm"
              title="Set staff login allowed hours"
            >
              Staff Access Time
            </Link>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={loadUsers}
              className="px-4 py-2 bg-white border border-gray-300 rounded"
            >
              Refresh
            </button>

            <Link
              href="/admin/users/create"
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              + Add User
            </Link>
          </div>
        </div>

        {/* Body */}
        {loading && <p>Loading users...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && sortedUsers.length === 0 && <p>No users found.</p>}

        {!loading && !error && sortedUsers.length > 0 && (
          <div className="overflow-x-auto bg-white rounded shadow">
            <table className="w-full border-collapse">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Username</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Mobile</th>
                  <th className="p-2 text-left">Role</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>

              <tbody>
                {sortedUsers.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">{u.name || "-"}</td>
                    <td className="p-2">{u.username || "-"}</td>
                    <td className="p-2">{u.email || "-"}</td>
                    <td className="p-2">{u.mobile || "-"}</td>
                    <td className="p-2 capitalize">{u.role}</td>
                    <td className="p-2">
                      {Number(u.is_active) === 1 ? (
                        <span className="text-green-700 font-semibold">Active</span>
                      ) : (
                        <span className="text-red-700 font-semibold">Inactive</span>
                      )}
                    </td>

                    <td className="p-2">
                      <div className="flex gap-2 flex-wrap">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="px-3 py-1 bg-gray-800 text-white rounded"
                        >
                          Edit
                        </Link>

                        <button
                          onClick={() => toggleActive(u)}
                          className={`px-3 py-1 rounded text-white ${
                            Number(u.is_active) === 1 ? "bg-red-600" : "bg-green-600"
                          }`}
                        >
                          {Number(u.is_active) === 1 ? "Disable" : "Enable"}
                        </button>

                        <button
                          onClick={() => openReset(u)}
                          className="px-3 py-1 rounded text-white bg-indigo-600"
                          title="Reset password (user will be forced to login again)"
                        >
                          Reset Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reset Password Modal */}
        {resetOpen && (
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
                padding: 18,
                boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
              }}
            >
              <h3 style={{ margin: 0 }}>Reset Password</h3>
              <p style={{ marginTop: 8, color: "#444" }}>
                User:{" "}
                <b>{resetUser?.name || resetUser?.username || resetUser?.email || `User #${resetUser?.id}`}</b>
              </p>

              <div style={{ marginTop: 12 }}>
                <label style={{ display: "block", marginBottom: 6 }}>New Password</label>
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="text"
                  placeholder="Enter new password"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                  }}
                />

                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generatePassword(10))}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Generate
                  </button>

                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(newPassword || "")}
                    disabled={!newPassword}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: !newPassword ? "#f3f3f3" : "#fff",
                      cursor: !newPassword ? "not-allowed" : "pointer",
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={closeReset}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#fff",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={doResetPassword}
                  disabled={resetLoading}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #222",
                    background: "#111",
                    color: "#fff",
                    cursor: resetLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {resetLoading ? "Resetting..." : "Reset"}
                </button>
              </div>

              <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
                After reset, user will be logged out automatically and must login with the new password.
              </p>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
