"use client";

import React, { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PermissionPicker from "@/components/PermissionPicker";


type Perm = { permission_key: string; description: string | null };

const ROLES = [
  "owner",
  "admin",
  "manager",
  "sales",
  "insurance",
  "vahan",
  "hsrp",
  "renewal",
  "rc",
];

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [permissions, setPermissions] = useState<Perm[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [extraPerms, setExtraPerms] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(true);

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    mobile: "",
    role: "sales",
    is_active: true,
  });

  const [pwd, setPwd] = useState({ newPassword: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);

  const defaultPerms = useMemo(() => {
    const role = String(form.role || "").toLowerCase();
    return new Set(rolePermissions[role] || []);
  }, [form.role, rolePermissions]);

  function handleChange(e: any) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  function togglePerm(key: string) {
    // default perms cannot be removed here (role handles them)
    if (defaultPerms.has(key)) return;

    setExtraPerms((prev) => {
      if (prev.includes(key)) return prev.filter((x) => x !== key);
      return [...prev, key];
    });
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [uRes, pRes] = await Promise.all([
        api.get(`/api/admin/users/${id}`),
        api.get(`/api/admin/permissions-catalog`),
      ]);

      if (!uRes.data?.success) throw new Error(uRes.data?.message || "Failed to load user");
      const u = uRes.data.user;
      setForm({
        name: u.name || "",
        username: u.username || "",
        email: u.email || "",
        mobile: u.mobile || "",
        role: u.role || "sales",
        is_active: !!u.is_active,
      });
      setExtraPerms(uRes.data.extraPermissions || []);

      if (pRes.data?.success) {
        setPermissions(pRes.data.permissions || []);
        setRolePermissions(pRes.data.rolePermissions || {});
      }
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveUser(e: any) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setMsg(null);

    if (!form.username.trim() && !form.email.trim() && !form.mobile.trim()) {
      setSaving(false);
      setErr("Fill at least one: Username OR Email OR Mobile.");
      return;
    }

    try {
      const payload = {
        name: form.name.trim() || null,
        username: form.username.trim() || null,
        email: form.email.trim() || null,
        mobile: form.mobile.trim() || null,
        role: form.role,
        is_active: form.is_active,
        permissions: extraPerms, // extra only
      };

      const res = await api.put(`/api/admin/users/${id}`, payload);
      if (!res.data?.success) throw new Error(res.data?.message || "Update failed");

      setMsg("Saved successfully ✅");
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    setErr(null);
    setMsg(null);

    if (!pwd.newPassword.trim() || pwd.newPassword.trim().length < 4) {
      setErr("New password must be at least 4 characters.");
      return;
    }
    if (pwd.newPassword !== pwd.confirm) {
      setErr("Password confirm does not match.");
      return;
    }

    const ok = confirm("Reset password for this user?");
    if (!ok) return;

    setPwdSaving(true);
    try {
      const res = await api.post(`/api/admin/users/${id}/reset-password`, {
        newPassword: pwd.newPassword,
      });
      if (!res.data?.success) throw new Error(res.data?.message || "Reset failed");

      setMsg("Password reset successfully ✅");
      setPwd({ newPassword: "", confirm: "" });
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Failed to reset password");
    } finally {
      setPwdSaving(false);
    }
  }

  async function quickToggleActive() {
    const next = !form.is_active;
    const ok = confirm(`Are you sure you want to ${next ? "ENABLE" : "DISABLE"} this user?`);
    if (!ok) return;

    try {
      await api.patch(`/api/admin/users/${id}/active`, { is_active: next });
      setForm((p) => ({ ...p, is_active: next }));
      setMsg("Status updated ✅");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to update status");
    }
  }

  if (loading) {
    return (
      <AuthGuard roles={["owner", "admin"]}>
        <div className="p-6">Loading...</div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard roles={["owner", "admin"]}>
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Edit User</h1>
          <Link href="/admin/users" className="px-4 py-2 bg-gray-800 text-white rounded">
            ← Back
          </Link>
        </div>

        <form onSubmit={saveUser} className="bg-white p-6 rounded shadow max-w-2xl space-y-4">
          <div className="flex justify-between items-center">
            <div className="font-semibold">
              User ID: <span className="text-gray-600">{id}</span>
            </div>
            <button
              type="button"
              onClick={quickToggleActive}
              className={`px-3 py-1 rounded text-white ${form.is_active ? "bg-red-600" : "bg-green-600"}`}
            >
              {form.is_active ? "Disable User" : "Enable User"}
            </button>
          </div>

          <div>
            <label className="block font-medium">Full Name</label>
            <input className="w-full p-2 border rounded mt-1" name="name" value={form.name} onChange={handleChange} />
          </div>

          <div>
            <label className="block font-medium">Username</label>
            <input className="w-full p-2 border rounded mt-1" name="username" value={form.username} onChange={handleChange} />
          </div>

          <div>
            <label className="block font-medium">Email</label>
            <input className="w-full p-2 border rounded mt-1" name="email" value={form.email} onChange={handleChange} />
          </div>

          <div>
            <label className="block font-medium">Mobile</label>
            <input className="w-full p-2 border rounded mt-1" name="mobile" value={form.mobile} onChange={handleChange} />
          </div>

          <div>
            <label className="block font-medium">Role</label>
            <select
              className="w-full p-2 border rounded mt-1"
              name="role"
              value={form.role}
              onChange={(e) => {
                setForm((p) => ({ ...p, role: e.target.value }));
                // keep extraPerms as-is (or reset if you want)
              }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
            Active User
          </label>

          {/* Advanced permissions */}
          <div className="border rounded p-3">
  <label className="flex items-center gap-2 font-semibold mb-3">
    <input
      type="checkbox"
      checked={showAdvanced}
      onChange={(e) => setShowAdvanced(e.target.checked)}
    />
    Advanced: Extra Permissions (user_permissions)
  </label>

  {showAdvanced && (
    <PermissionPicker
      permissions={permissions}
      selected={extraPerms}
      onChangeSelected={setExtraPerms}
      roleDefaultKeys={defaultPerms}
    />
  )}
</div>


          {err && <p className="text-red-600">{err}</p>}
          {msg && <p className="text-green-700">{msg}</p>}

          <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white p-3 rounded">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>

        {/* Reset Password */}
        <div className="bg-white p-6 rounded shadow max-w-2xl mt-6 space-y-3">
          <h2 className="text-xl font-bold">Reset Password</h2>

          <div>
            <label className="block font-medium">New Password</label>
            <input
              type="password"
              className="w-full p-2 border rounded mt-1"
              value={pwd.newPassword}
              onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))}
            />
          </div>

          <div>
            <label className="block font-medium">Confirm Password</label>
            <input
              type="password"
              className="w-full p-2 border rounded mt-1"
              value={pwd.confirm}
              onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
            />
          </div>

          <button
            type="button"
            disabled={pwdSaving}
            onClick={resetPassword}
            className="px-4 py-2 bg-purple-700 text-white rounded"
          >
            {pwdSaving ? "Resetting..." : "Reset Password"}
          </button>
        </div>
      </div>
    </AuthGuard>
  );
}
