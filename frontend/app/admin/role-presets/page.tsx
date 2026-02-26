"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

export default function RolePresetsPage() {
  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState<Record<string, any>>({});
  const [applying, setApplying] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/role-presets");
      setPresets(res.data?.presets || {});
    } catch {
      setPresets({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const apply = async () => {
    setApplying(true);
    try {
      await api.post("/api/admin/role-presets/apply");
      alert("✅ Role presets applied!");
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to apply presets");
    } finally {
      setApplying(false);
    }
  };

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h1 className="text-2xl font-bold">Role Presets</h1>

          <button
            onClick={apply}
            disabled={applying}
            className="px-4 py-2 rounded bg-red-600 text-white font-semibold disabled:opacity-60"
          >
            {applying ? "Applying..." : "Apply Presets"}
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          This will REPLACE role permissions for owner/admin/sales/insurance/rto using preset rules.
        </p>

        {loading ? (
          <div className="text-gray-600">Loading...</div>
        ) : (
          <div className="space-y-4">
            {Object.keys(presets).length === 0 ? (
              <div className="text-gray-600">No presets found</div>
            ) : (
              Object.entries(presets).map(([role, keys]) => (
                <div key={role} className="bg-white rounded-xl shadow p-4">
                  <div className="font-semibold mb-2">{role.toUpperCase()}</div>
                  <div className="text-sm text-gray-700 break-words">
                    {keys === "__ALL__" ? (
                      <span>All permissions (auto from DB)</span>
                    ) : (
                      <span>{Array.isArray(keys) ? keys.join(", ") : "-"}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
