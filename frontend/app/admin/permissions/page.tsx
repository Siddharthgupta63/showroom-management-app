"use client";

import React, { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import ROLES from "@/constants/roles";

type Perm = { permission_key: string; description: string | null };

function categoryOf(key: string) {
  const k = (key || "").toLowerCase();
  if (k.startsWith("contacts_")) return "Contacts";
  if (k.includes("whatsapp")) return "WhatsApp";
  if (k.includes("insurance") || k.includes("renew")) return "Insurance";
  if (k.includes("hsrp")) return "HSRP";
  if (k.includes("rc") || k.includes("rto") || k.includes("vahan")) return "RTO / RC";
  if (k.includes("permission") || k.includes("admin") || k.includes("manage_")) return "Admin";
  if (k.includes("import") || k.includes("export") || k.includes("excel") || k.includes("bulk"))
    return "Import / Export";
  return "Other";
}

export default function AdminPermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [permissions, setPermissions] = useState<Perm[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});

  const [search, setSearch] = useState("");
  const [onlyRole, setOnlyRole] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/admin/permissions-catalog");
      setPermissions(res.data?.permissions || []);
      setRolePermissions(res.data?.rolePermissions || {});
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load permissions");
      setPermissions([]);
      setRolePermissions({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const normalized = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const r of ROLES) {
      map[r] = new Set((rolePermissions?.[r] || []).map((x) => String(x)));
    }
    return map;
  }, [rolePermissions]);

  const filteredPerms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter((p) => {
      const k = (p.permission_key || "").toLowerCase();
      const d = (p.description || "").toLowerCase();
      return k.includes(q) || d.includes(q);
    });
  }, [permissions, search]);

  const grouped = useMemo(() => {
    const map: Record<string, Perm[]> = {};
    for (const p of filteredPerms) {
      const cat = categoryOf(p.permission_key);
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    }
    const order = [
      "Contacts",
      "Insurance",
      "RTO / RC",
      "HSRP",
      "WhatsApp",
      "Admin",
      "Import / Export",
      "Other",
    ];
    const out: Record<string, Perm[]> = {};
    for (const cat of order) {
      if (map[cat]?.length) {
        out[cat] = map[cat]
          .slice()
          .sort((a, b) => a.permission_key.localeCompare(b.permission_key));
      }
    }
    return out;
  }, [filteredPerms]);

  const visibleRoles = onlyRole === "all" ? ROLES : ROLES.filter((r) => r === onlyRole);

  const isChecked = (role: string, key: string) => normalized?.[role]?.has(key) || false;

  const toggle = (role: string, key: string) => {
    setRolePermissions((prev) => {
      const r = String(role).toLowerCase();
      const set = new Set((prev?.[r] || []).map(String));
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...prev, [r]: Array.from(set).sort() };
    });
  };

  const setAllVisibleForRole = (role: string, value: boolean) => {
    const allKeys = filteredPerms.map((p) => p.permission_key);
    setRolePermissions((prev) => {
      const r = String(role).toLowerCase();
      const set = new Set((prev?.[r] || []).map(String));
      for (const k of allKeys) {
        if (value) set.add(k);
        else set.delete(k);
      }
      return { ...prev, [r]: Array.from(set).sort() };
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/admin/role-permissions", { rolePermissions });
      alert("✅ Role permissions saved");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const applyPresets = async () => {
    setApplying(true);
    setError(null);
    try {
      await api.post("/api/admin/role-presets/apply");
      alert("✅ Role presets applied");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to apply presets");
    } finally {
      setApplying(false);
    }
  };

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Role Permissions</h1>
            <p className="text-sm text-gray-600">
              Control what each role can do (Contacts, Insurance, WhatsApp, HSRP, Export, etc.).
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Dashboard tiles visibility is separate: go to{" "}
              <span className="font-mono">/admin/dashboard-permissions</span>
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={applyPresets}
              disabled={loading || applying}
              className="px-4 py-2 rounded border bg-white font-semibold disabled:opacity-60"
              title="Re-apply default presets (overwrites role permissions)"
            >
              {applying ? "Applying..." : "Apply Role Presets"}
            </button>

            <button
              onClick={save}
              disabled={loading || saving}
              className="px-4 py-2 rounded bg-red-600 text-white font-semibold disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search permission key / description"
              className="flex-1 px-3 py-2 border rounded"
            />

            <select
              value={onlyRole}
              onChange={(e) => setOnlyRole(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="all">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-600">Loading...</div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, perms]) => (
              <div key={cat} className="bg-white rounded-xl shadow">
                <div className="p-4 border-b flex items-center justify-between flex-wrap gap-2">
                  <div className="font-semibold">{cat}</div>
                  <div className="text-xs text-gray-500">{perms.length} permissions</div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="p-3 text-left">Permission</th>
                        {visibleRoles.map((r) => (
                          <th key={r} className="p-3 text-center whitespace-nowrap">
                            <div className="font-semibold">{r}</div>
                            <div className="mt-2 flex items-center justify-center gap-2">
                              <button
                                onClick={() => setAllVisibleForRole(r, true)}
                                className="text-xs px-2 py-1 rounded border bg-white"
                                type="button"
                              >
                                All
                              </button>
                              <button
                                onClick={() => setAllVisibleForRole(r, false)}
                                className="text-xs px-2 py-1 rounded border bg-white"
                                type="button"
                              >
                                None
                              </button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {perms.map((p) => (
                        <tr key={p.permission_key} className="border-t">
                          <td className="p-3">
                            <div className="font-mono text-xs">{p.permission_key}</div>
                            {p.description && (
                              <div className="text-xs text-gray-600 mt-1">{p.description}</div>
                            )}
                          </td>

                          {visibleRoles.map((r) => (
                            <td key={r} className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked(r, p.permission_key)}
                                onChange={() => toggle(r, p.permission_key)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}