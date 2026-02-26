"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";

type DDItem = { id: number; value: string; label?: string | null };
type ModelRow = { id: number; model_name: string; is_active?: number };
type VariantRow = { id: number; model_id: number; variant_name: string; is_active?: number };

function formatColorLabel(item: DDItem) {
  return item.label ? `${item.value} — ${item.label}` : item.value;
}

export default function VehicleEditPage() {
  const { id } = useParams();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // dropdown options
  const [colorOptions, setColorOptions] = useState<DDItem[]>([]);
  const [makeOptions, setMakeOptions] = useState<DDItem[]>([]);

  // catalog options
  const [models, setModels] = useState<ModelRow[]>([]);
  const [variantsByModel, setVariantsByModel] = useState<Record<number, VariantRow[]>>({});
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // ✅ track if user manually edited Model (Text)
  const [vehicleModelTouched, setVehicleModelTouched] = useState(false);

  const user = getUser();
  const role = String(user?.role || "").toLowerCase();
  const canEditChassisEngine = role === "owner" || role === "admin" || role === "manager";

  const selectedModelId = Number(data?.model_id || 0);
  const selectedVariantId = Number(data?.variant_id || 0);

  const selectedModelName = useMemo(() => {
    if (!selectedModelId) return "";
    return models.find((m) => Number(m.id) === selectedModelId)?.model_name || "";
  }, [models, selectedModelId]);

  const selectedVariantName = useMemo(() => {
    if (!selectedModelId || !selectedVariantId) return "";
    const list = variantsByModel[selectedModelId] || [];
    return list.find((v) => Number(v.id) === selectedVariantId)?.variant_name || "";
  }, [variantsByModel, selectedModelId, selectedVariantId]);

  const autoComposedVehicleModel = useMemo(() => {
    const label = [selectedModelName, selectedVariantName].filter(Boolean).join(" ").trim();
    return label || "";
  }, [selectedModelName, selectedVariantName]);

  const tryGet = async (paths: string[], params?: any) => {
    let lastErr: any = null;
    for (const p of paths) {
      try {
        const res = await api.get(p, { params });
        return res;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  };

  const loadDropdowns = async () => {
    try {
      const res = await api.get("/api/dropdowns", { params: { types: "vehicle_color,vehicle_make" } });
      const d = res.data?.data || {};

      const colors: DDItem[] = (d.vehicle_color || [])
        .map((x: any) => ({
          id: Number(x.id),
          value: String(x.value || ""),
          label: x.label ? String(x.label) : null,
        }))
        .filter((x: DDItem) => x.value);

      const makes: DDItem[] = (d.vehicle_make || [])
        .map((x: any) => ({ id: Number(x.id), value: String(x.value || "") }))
        .filter((x: DDItem) => x.value);

      setColorOptions(colors);
      setMakeOptions(makes);
    } catch {
      setColorOptions([]);
      setMakeOptions([]);
    }
  };

  const loadModels = async () => {
    setLoadingCatalog(true);
    try {
      const res = await tryGet(
        ["/api/vehicleCatalog/models", "/api/vehicle-catalog/models", "/api/admin/vehicle-catalog/models"],
        { includeInactive: 0 }
      );
      const list: any[] = res.data?.data || res.data || [];
      const cleaned = (list || [])
        .map((x: any) => ({
          id: Number(x.id),
          model_name: String(x.model_name ?? x.name ?? ""),
          is_active: x.is_active,
        }))
        .filter((x: ModelRow) => x.id && x.model_name);
      setModels(cleaned);
    } catch {
      setModels([]);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const loadVariants = async (modelId: number) => {
    if (!modelId) return;
    if (variantsByModel[modelId]) return;

    setLoadingCatalog(true);
    try {
      const res = await tryGet(
        ["/api/vehicleCatalog/variants", "/api/vehicle-catalog/variants", "/api/admin/vehicle-catalog/variants"],
        { model_id: modelId, includeInactive: 0 }
      );
      const list: any[] = res.data?.data || res.data || [];
      const cleaned = (list || [])
        .map((x: any) => ({
          id: Number(x.id),
          model_id: Number(x.model_id),
          variant_name: String(x.variant_name ?? x.name ?? ""),
          is_active: x.is_active,
        }))
        .filter((x: VariantRow) => x.id && x.variant_name);

      setVariantsByModel((prev) => ({ ...prev, [modelId]: cleaned }));
    } catch {
      setVariantsByModel((prev) => ({ ...prev, [modelId]: [] }));
    } finally {
      setLoadingCatalog(false);
    }
  };

  const load = async () => {
    try {
      setErr("");
      setLoading(true);

      await Promise.all([loadDropdowns(), loadModels()]);

      const vres = await api.get(`/api/vehicles/${id}`);
      const v = vres.data?.data ?? null;

      setData(v);
      setVehicleModelTouched(false);

      const mid = Number(v?.model_id || 0);
      if (mid > 0) await loadVariants(mid);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async () => {
    try {
      setSaving(true);

      const payload: any = { ...data };

      // ✅ Always keep model_id/variant_id (no other mode)
      // ✅ If user didn't type custom model text, sync from catalog at save-time
      if (!vehicleModelTouched) {
        const mn = models.find((m) => Number(m.id) === Number(payload.model_id || 0))?.model_name || "";
        const vlist = Number(payload.model_id || 0) ? variantsByModel[Number(payload.model_id)] || [] : [];
        const vn = vlist.find((v) => Number(v.id) === Number(payload.variant_id || 0))?.variant_name || "";
        const label = [mn, vn].filter(Boolean).join(" ").trim();
        payload.vehicle_model = label || mn || null;
      } else {
        payload.vehicle_model = String(payload.vehicle_model || "").trim() || null;
      }

      await api.put(`/api/vehicles/${id}`, payload);
      alert("Updated ✅");
      router.push(`/vehicles/${id}`);
    } catch (e: any) {
      alert(e?.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!data) return <div className="p-6">Not found</div>;

  const variantList = selectedModelId ? variantsByModel[selectedModelId] || [] : [];

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-bold mb-2">Edit Vehicle #{id}</h1>
            <Link href={`/vehicles/${id}`} className="px-4 py-2 border rounded-lg">
              Back
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Chassis Number"
              disabled={!canEditChassisEngine}
              value={data.chassis_number}
              onChange={(v: any) => setData({ ...data, chassis_number: v })}
            />

            <Input
              label="Engine Number"
              disabled={!canEditChassisEngine}
              value={data.engine_number}
              onChange={(v: any) => setData({ ...data, engine_number: v })}
            />

            {/* ✅ Make: dropdown only (no Other) */}
            <div>
              <label className="text-sm font-medium">Make</label>
              <select
                value={String(data.vehicle_make || "")}
                onChange={(e) => setData({ ...data, vehicle_make: e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2 bg-white"
              >
                <option value="">-- Select Make --</option>
                {makeOptions.map((m) => (
                  <option key={m.id} value={m.value}>
                    {m.value}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Stored value remains the make text.</p>
            </div>

            {/* ✅ Model/Variant: catalog only (no Other) */}
            <div className="md:col-span-2 border rounded-xl p-4 bg-gray-50">
              <div className="font-semibold">Model / Variant</div>
              <div className="text-xs text-gray-600">
                Catalog selection saves model_id + variant_id. Model text auto-syncs unless you type custom text below.
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Model (Catalog)</label>
                  <select
                    value={String(selectedModelId || "")}
                    onChange={async (e) => {
                      const mid = Number(e.target.value || 0);

                      setData((prev: any) => ({
                        ...prev,
                        model_id: mid || null,
                        variant_id: null,
                      }));

                      if (mid > 0) await loadVariants(mid);

                      if (!vehicleModelTouched) {
                        const mn = models.find((m) => Number(m.id) === mid)?.model_name || "";
                        setData((prev: any) => ({ ...prev, vehicle_model: mn || null }));
                      }
                    }}
                    className="mt-1 w-full border rounded-lg px-3 py-2 bg-white"
                    disabled={loadingCatalog}
                  >
                    <option value="">-- Select Model --</option>
                    {models.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.model_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Variant (Catalog)</label>
                  <select
                    value={String(selectedVariantId || "")}
                    onChange={(e) => {
                      const vid = Number(e.target.value || 0);

                      setData((prev: any) => {
                        const next = { ...prev, variant_id: vid || null };

                        if (!vehicleModelTouched) {
                          const mn = models.find((m) => Number(m.id) === Number(prev.model_id || 0))?.model_name || "";
                          const vlist = Number(prev.model_id || 0) ? variantsByModel[Number(prev.model_id)] || [] : [];
                          const vn = vlist.find((v) => Number(v.id) === vid)?.variant_name || "";
                          const label = [mn, vn].filter(Boolean).join(" ").trim();
                          next.vehicle_model = label || mn || null;
                        }

                        return next;
                      });
                    }}
                    className="mt-1 w-full border rounded-lg px-3 py-2 bg-white"
                    disabled={loadingCatalog || !selectedModelId}
                  >
                    <option value="">-- Select Variant --</option>
                    {variantList.map((v) => (
                      <option key={v.id} value={String(v.id)}>
                        {v.variant_name}
                      </option>
                    ))}
                  </select>

                  {selectedModelId ? (
                    <div className="text-xs text-gray-500 mt-1">Selected: {autoComposedVehicleModel || selectedModelName || "-"}</div>
                  ) : (
                    <div className="text-xs text-gray-500 mt-1">Select a model to load variants.</div>
                  )}
                </div>
              </div>

              {/* keep old field (text) */}
              <div className="mt-4">
                <Input
                  label="Model (Text)"
                  value={data.vehicle_model}
                  onChange={(v: any) => {
                    setVehicleModelTouched(true);
                    setData({ ...data, vehicle_model: v });
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  If you type here, we will NOT auto-change it when you change Model/Variant.
                </p>
              </div>
            </div>

            {/* ✅ Color dropdown (code + full form display) */}
            <div>
              <label className="text-sm font-medium">Color</label>
              <select
                value={String(data.color || "")}
                onChange={(e) => setData({ ...data, color: e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2 bg-white"
              >
                <option value="">-- Select Color --</option>
                {colorOptions.map((c) => (
                  <option key={c.id} value={c.value}>
                    {formatColorLabel(c)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Stored value remains the color code (example: BKB). Full form is only for display.
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
              {saving ? "Saving..." : "Save"}
            </button>

            <Link href={`/vehicles/${id}`} className="px-4 py-2 border rounded-lg">
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function Input({ label, value, onChange, disabled = false }: any) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        disabled={disabled}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border rounded-lg px-3 py-2"
      />
    </div>
  );
}