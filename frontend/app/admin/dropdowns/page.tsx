"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";
import Link from "next/link";

type Row = {
  id: number;
  type: string;
  value: string;
  label?: string | null;
  is_active: number;
  created_at?: string | null;
};

type CatalogModel = { id: number; model_name: string; is_active: number };
type CatalogVariant = { id: number; model_id: number; variant_name: string; is_active: number };

const TYPES: Array<{ key: string; label: string }> = [
  { key: "insurance_company", label: "Insurance Company" },
  { key: "insurance_broker", label: "Insurance Broker" },
  { key: "finance_company", label: "Finance Company" },
  { key: "tyre", label: "Tyre" },
  { key: "helmet", label: "Helmet" },
  { key: "branch", label: "Branch" },

  { key: "vehicle_make", label: "Vehicle Make" },
  { key: "vehicle_color", label: "Vehicle Color (Code + Full Form)" },
  { key: "vehicle_purchase_from", label: "Purchase From" },
  { key: "nominee_relation", label: "Nominee Relation" },
  { key: "rc_agent", label: "RC Agent" },

  { key: "vehicle_models", label: "Vehicle Models" },
  { key: "vehicle_variants", label: "Vehicle Variants" },
];

export default function AdminDropdownsPage() {
  const { hasPermission, loading: permsLoading } = usePermissions();

  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState("");
  useEffect(() => {
    setMounted(true);
    setRole(String(getUser()?.role || "").toLowerCase());
  }, []);

  const isOwnerAdmin = role === "owner" || role === "admin";

  const canManage = isOwnerAdmin;

  const [type, setType] = useState<string>(TYPES[0].key);
  const [includeInactive, setIncludeInactive] = useState(true);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const isCatalogModels = type === "vehicle_models";
  const isCatalogVariants = type === "vehicle_variants";
  const isCatalogMode = isCatalogModels || isCatalogVariants;

  const isVehicleColor = type === "vehicle_color";

  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const [catalogModels, setCatalogModels] = useState<CatalogModel[]>([]);
  const [catalogModelId, setCatalogModelId] = useState<string>("");

  const filtered = useMemo(() => {
    if (includeInactive) return rows;
    return rows.filter((r) => Number(r.is_active) === 1);
  }, [rows, includeInactive]);

  const loadCatalogModelsForSelector = async () => {
    const res = await api.get("/api/vehicleCatalog/models");
    const list: CatalogModel[] = res.data?.data || [];
    setCatalogModels(list);

    if (!catalogModelId) {
      const firstActive = list.find((m) => Number(m.is_active) === 1) || list[0];
      if (firstActive) setCatalogModelId(String(firstActive.id));
    }
  };

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      if (isCatalogModels) {
        const res = await api.get("/api/vehicleCatalog/models");
        const list: CatalogModel[] = res.data?.data || [];

        const mapped: Row[] = list.map((m) => ({
          id: Number(m.id),
          type: "vehicle_models",
          value: String(m.model_name || ""),
          is_active: Number(m.is_active) === 1 ? 1 : 0,
        }));

        setRows(mapped);
        return;
      }

      if (isCatalogVariants) {
        if (!catalogModels.length) await loadCatalogModelsForSelector();

        const mid = Number(catalogModelId || 0);
        if (!mid) {
          setRows([]);
          return;
        }

        const res = await api.get("/api/vehicleCatalog/variants", { params: { model_id: mid } });
        const list: CatalogVariant[] = res.data?.data || [];

        const mapped: Row[] = list.map((v) => ({
          id: Number(v.id),
          type: "vehicle_variants",
          value: String(v.variant_name || ""),
          is_active: Number(v.is_active) === 1 ? 1 : 0,
        }));

        setRows(mapped);
        return;
      }

      const res = await api.get("/api/dropdowns/admin", {
        params: { type, includeInactive: includeInactive ? 1 : 0 },
      });
      setRows(res.data?.data || []);
    } catch (e: any) {
      setRows([]);
      setErr(e?.response?.data?.message || "Failed to load dropdowns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permsLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permsLoading, type, includeInactive]);

  useEffect(() => {
    if (!isCatalogVariants) return;
    loadCatalogModelsForSelector().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    if (!isCatalogVariants) return;
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogModelId]);

  useEffect(() => {
    setNewValue("");
    setNewLabel("");
  }, [type]);

  const onAdd = async () => {
    if (!canManage) return alert("Only Owner/Admin can manage dropdowns.");
    const v = newValue.trim();
    const l = newLabel.trim();
    if (!v) return;

    try {
      if (isCatalogModels) {
        await api.post("/api/vehicleCatalog/models", { model_name: v });
        setNewValue("");
        await load();
        return;
      }

      if (isCatalogVariants) {
        const mid = Number(catalogModelId || 0);
        if (!mid) {
          alert("Select a model first");
          return;
        }
        await api.post("/api/vehicleCatalog/variants", { model_id: mid, variant_name: v });
        setNewValue("");
        await load();
        return;
      }

      await api.post(`/api/dropdowns/${type}`, {
        value: v,
        label: isVehicleColor ? (l || null) : null,
      });

      setNewValue("");
      setNewLabel("");
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Add failed");
    }
  };

  const setActive = async (id: number, is_active: number) => {
    if (!canManage) return alert("Only Owner/Admin can manage dropdowns.");
    try {
      if (isCatalogModels) {
        await api.patch(`/api/vehicleCatalog/models/${id}`, { is_active });
        await load();
        return;
      }
      if (isCatalogVariants) {
        await api.patch(`/api/vehicleCatalog/variants/${id}`, { is_active });
        await load();
        return;
      }

      await api.patch(`/api/dropdowns/${id}`, { is_active });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Update failed");
    }
  };

  if (!mounted) return null;

  return (
    <AuthGuard>
      <div className="p-6">
        {!permsLoading && !canManage ? (
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-bold">Dropdown Master</h1>
              <Link href="/dashboard" className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">
                Back
              </Link>
            </div>
            <p className="mt-2 text-sm text-gray-600">Permission denied. (Only Owner/Admin can manage dropdowns.)</p>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold">Dropdown Master</h1>
                <p className="text-sm text-gray-500">Add / Disable values (no delete)</p>
                {isCatalogMode ? (
                  <p className="text-xs text-gray-500 mt-1">
                    Note: Models/Variants are stored in separate tables (vehicle_models / vehicle_variants).
                  </p>
                ) : null}
              </div>
              <Link href="/dashboard" className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">
                ← Back
              </Link>
            </div>

            <div className="mt-4 flex gap-3 flex-wrap items-end">
              <div>
                <div className="text-sm text-gray-600 mb-1">Type</div>
                <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2 border rounded-lg">
                  {TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {isCatalogVariants && (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Model</div>
                  <select
                    value={catalogModelId}
                    onChange={(e) => setCatalogModelId(e.target.value)}
                    className="px-3 py-2 border rounded-lg"
                  >
                    <option value="">-- Select Model --</option>
                    {(includeInactive ? catalogModels : catalogModels.filter((m) => Number(m.is_active) === 1)).map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.model_name} {Number(m.is_active) === 1 ? "" : "(Disabled)"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
                Show inactive
              </label>

              <div className="flex-1 min-w-[260px]">
                <div className="text-sm text-gray-600 mb-1">
                  {isVehicleColor ? "Add new color (Code + Full Form)" : "Add new value"}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <input
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder={
                      isCatalogModels
                        ? "Type model name..."
                        : isCatalogVariants
                        ? "Type variant name..."
                        : isVehicleColor
                        ? "Color code (e.g., BKB)"
                        : "Type value..."
                    }
                    className="flex-1 min-w-[220px] px-3 py-2 border rounded-lg"
                  />

                  {isVehicleColor && !isCatalogMode ? (
                    <input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Full form (e.g., Nexa Blue) (optional)"
                      className="flex-1 min-w-[240px] px-3 py-2 border rounded-lg"
                    />
                  ) : null}

                  <button
                    onClick={onAdd}
                    className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black"
                  >
                    Add
                  </button>
                </div>
              </div>

              <button onClick={load} className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">
                Refresh
              </button>
            </div>

            {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}

            <div className="mt-4 overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 border-b text-left">ID</th>

                    {isVehicleColor && !isCatalogMode ? (
                      <>
                        <th className="px-3 py-2 border-b text-left">Code</th>
                        <th className="px-3 py-2 border-b text-left">Full Form</th>
                      </>
                    ) : (
                      <th className="px-3 py-2 border-b text-left">
                        {isCatalogModels ? "Model" : isCatalogVariants ? "Variant" : "Value"}
                      </th>
                    )}

                    <th className="px-3 py-2 border-b text-left">Status</th>
                    <th className="px-3 py-2 border-b text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isVehicleColor && !isCatalogMode ? 5 : 4} className="px-3 py-3">
                        Loading…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={isVehicleColor && !isCatalogMode ? 5 : 4} className="px-3 py-3 text-gray-500">
                        No values.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const active = Number(r.is_active) === 1;
                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 border-b">{r.id}</td>

                          {isVehicleColor && !isCatalogMode ? (
                            <>
                              <td className="px-3 py-2 border-b font-mono">{r.value}</td>
                              <td className="px-3 py-2 border-b">
                                {r.label || <span className="text-gray-400">—</span>}
                              </td>
                            </>
                          ) : (
                            <td className="px-3 py-2 border-b">{r.value}</td>
                          )}

                          <td className="px-3 py-2 border-b">
                            {active ? (
                              <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">Active</span>
                            ) : (
                              <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">Disabled</span>
                            )}
                          </td>

                          <td className="px-3 py-2 border-b text-right">
                            {active ? (
                              <button
                                onClick={() => setActive(r.id, 0)}
                                className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50"
                              >
                                Disable
                              </button>
                            ) : (
                              <button
                                onClick={() => setActive(r.id, 1)}
                                className="px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-black"
                              >
                                Enable
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Tip: Disabling hides values from dropdowns, but keeps historical data safe.
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}