"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";

type ModelRow = { id: number; model_name: string; is_active?: number };
type VariantRow = { id: number; model_id: number; variant_name: string; is_active?: number };
type DDItem = { id: number; value: string; label?: string | null };

type VehicleStatus = {
  code: "NEW" | "DUPLICATE" | "UNLINKED" | "SOLD" | "INVALID";
  label: string;
  vehicle_id: number | null;
  sale_id: number | null;
  is_sold: boolean;
  is_unlinked: boolean;
};

type ExtractVehicleRow = {
  model?: string | null;
  variant?: string | null;
  color?: string | null;      // human color like "Black"
  color_code?: string | null; // code like "BKG/BHG/BKB"
  engine_number?: string | null;
  chassis_number?: string | null;
  model_id?: number | null;
  variant_id?: number | null;
  status?: VehicleStatus;
  _match_debug?: any;
};

type ExtractResult = {
  invoice_number?: string | null;
  invoice_date?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  vehicles: ExtractVehicleRow[];
  raw_hint?: string | null;
};

// ----------------------- helpers -----------------------
function normalizeStr(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

function matchOption(val: string | null | undefined, options: DDItem[]) {
  const d = normalizeStr(val);
  if (!d) return "";
  const hit = options.find((o) => normalizeStr(o.value) === d);
  return hit ? hit.value : "";
}

function uniqKey() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ✅ NEW: display formatter for color dropdown
function formatColorLabel(item: DDItem) {
  return item.label ? `${item.value} — ${item.label}` : item.value;
}

export default function NewVehiclePage() {
  const router = useRouter();
  const sp = useSearchParams();
  const debug = sp?.get("debug") === "1";

  const { hasPermission, loading: permsLoading } = usePermissions();

  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    setRole(String(u?.role || "").toLowerCase());
  }, []);

  const isOwnerAdmin = role === "owner" || role === "admin";
  const canCreate = isOwnerAdmin || hasPermission("vehicles_create") || hasPermission("vehicles_manage");

  // ---------------- common fields ----------------
  const [contactId, setContactId] = useState<string>(""); // optional
  const [make, setMake] = useState("");
  const [makeOptions, setMakeOptions] = useState<DDItem[]>([]);

  // ---------------- manual single input ----------------
  const [chassis, setChassis] = useState("");
  const [engine, setEngine] = useState("");
  const [color, setColor] = useState("");
  const [colorOptions, setColorOptions] = useState<DDItem[]>([]);

  // Catalog selection (optional)
  const [models, setModels] = useState<ModelRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [modelId, setModelId] = useState<string>("");
  const [variantId, setVariantId] = useState<string>("");

  const [variantsByModel, setVariantsByModel] = useState<Record<number, VariantRow[]>>({});
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [saveAndAddAnother, setSaveAndAddAnother] = useState(false);

  const normalizedChassis = useMemo(() => chassis.trim(), [chassis]);
  const normalizedEngine = useMemo(() => engine.trim(), [engine]);

  // ---------------- PDF extract state ----------------
  const [pdfLoading, setPdfLoading] = useState(false);
  const [extract, setExtract] = useState<ExtractResult | null>(null);
  const [extractDebug, setExtractDebug] = useState<any>(null);

  const [extractRows, setExtractRows] = useState<
    Array<
      ExtractVehicleRow & {
        ui_model_id: string;
        ui_variant_id: string;
        ui_color: string; // dropdown value (code)
      }
    >
  >([]);

  // ---------------- NEW: Manual Multi-Add list ----------------
  type ManualRow = {
    _k: string;
    chassis_number: string;
    engine_number: string;
    ui_model_id: string;   // "" => Other
    ui_variant_id: string; // "" => Other
    ui_color: string;      // dropdown code (BKB/BKG/BHG etc)
  };

  const [manualRows, setManualRows] = useState<ManualRow[]>([]);

  // ---------------- catalog fetch helpers ----------------
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

  const loadModels = async () => {
    setLoadingCatalog(true);
    try {
      const res = await tryGet(
        ["/api/vehicle-catalog/models", "/api/admin/vehicle-catalog/models", "/api/vehicleCatalog/models"],
        { includeInactive: 0 }
      );
      const list: any[] = res.data?.data || res.data || [];
      const cleaned = (list || [])
        .map((x: any) => ({
          id: Number(x.id),
          model_name: String(x.model_name ?? x.name ?? x.value ?? ""),
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

  const loadVariants = async (mid: number) => {
    setLoadingCatalog(true);
    try {
      const res = await tryGet(
        ["/api/vehicle-catalog/variants", "/api/admin/vehicle-catalog/variants", "/api/vehicleCatalog/variants"],
        { model_id: mid, includeInactive: 0 }
      );

      const list: any[] = res.data?.data || res.data || [];
      const cleaned = (list || [])
        .map((x: any) => ({
          id: Number(x.id),
          model_id: Number(x.model_id),
          variant_name: String(x.variant_name ?? x.name ?? x.value ?? ""),
          is_active: x.is_active,
        }))
        .filter((x: VariantRow) => x.id && x.variant_name);

      setVariants(cleaned);
      setVariantsByModel((prev) => ({ ...prev, [mid]: cleaned }));
    } catch {
      setVariants([]);
      setVariantsByModel((prev) => ({ ...prev, [mid]: [] }));
    } finally {
      setLoadingCatalog(false);
    }
  };

  // ✅ Dropdown master (Make + Color)
  const loadDropdowns = async () => {
    try {
      const res = await api.get("/api/dropdowns", {
        params: { types: "vehicle_make,vehicle_color" },
      });
      const data = res.data?.data || {};

      const makes: DDItem[] = (data.vehicle_make || [])
        .map((x: any) => ({ id: Number(x.id), value: String(x.value ?? x.label ?? x.name ?? "") }))
        .filter((x: DDItem) => x.value);

      // your colors are codes; filter junk only
      const badColor = (v: string) => {
        const x = normalizeStr(v);
        return !x || x === "--" || x === "-" || x.includes("hsn");
      };

      const colors: DDItem[] = (data.vehicle_color || [])
        .map((x: any) => ({
          id: Number(x.id),
          value: String(x.value || ""),
          label: x.label ? String(x.label) : null,
        }))
        .filter((x: DDItem) => x.value && !badColor(x.value));

      setMakeOptions(makes);
      setColorOptions(colors);

      if (!make && makes.length > 0) setMake(makes[0].value);
    } catch {
      setMakeOptions([]);
      setColorOptions([]);
      if (!make) setMake("HERO BIKE");
    }
  };

  useEffect(() => {
    loadModels();
    loadDropdowns();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const mid = Number(modelId || 0);
    setVariantId("");
    setVariants([]);
    if (mid > 0) loadVariants(mid);
    // eslint-disable-next-line
  }, [modelId]);

  // ✅ Fix color auto-select race for extractRows
  useEffect(() => {
    if (!colorOptions.length) return;
    if (!extractRows.length) return;

    setExtractRows((prev) =>
      prev.map((r) => {
        if (r.ui_color) return r;
        const byCode = matchOption(r.color_code || "", colorOptions);
        const byName = matchOption(r.color || "", colorOptions);
        return { ...r, ui_color: byCode || byName || "" };
      })
    );
  }, [colorOptions]); // eslint-disable-line

  // ---------------- PDF extract helpers ----------------
  const extractFromPdf = async (file: File) => {
    setPdfLoading(true);
    setExtract(null);
    setExtractRows([]);
    setExtractDebug(null);
    setErr("");
    setOk("");

    try {
      const fd = new FormData();
      fd.append("file", file);

      const url = debug ? "/api/vehicles/_invoice/extract?debug=1" : "/api/vehicles/_invoice/extract";
      const res = await api.post(url, fd, { headers: { "Content-Type": "multipart/form-data" } });

      const data: ExtractResult | null = res.data?.data || null;
      setExtract(data);
      setExtractDebug(res.data?.debug || null);

      const rows = (data?.vehicles || []).map((r) => {
        const colorByCode = matchOption(r.color_code || "", colorOptions);
        const colorByName = matchOption(r.color || "", colorOptions);

        return {
          ...r,
          ui_model_id: r?.model_id ? String(r.model_id) : "",
          ui_variant_id: r?.variant_id ? String(r.variant_id) : "",
          ui_color: colorByCode || colorByName || "",
        };
      });

      setExtractRows(rows);

      // prefetch variants for detected model_ids
      const mids = Array.from(new Set(rows.map((x) => Number(x.model_id || 0)).filter((x) => x > 0)));
      for (const mid of mids) {
        if (!variantsByModel[mid]) await loadVariants(mid);
      }

      setOk("PDF extracted ✅");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "PDF extraction failed");
    } finally {
      setPdfLoading(false);
    }
  };

  const isDuplicateRow = (r: any) => {
    const code = r?.status?.code;
    return code && code !== "NEW";
  };

  const updateExtractRow = (idx: number, patch: Partial<any>) => {
    setExtractRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  const onRowModelChange = async (idx: number, val: string) => {
    updateExtractRow(idx, { ui_model_id: val, ui_variant_id: "" });
    const mid = Number(val || 0);
    if (mid > 0 && !variantsByModel[mid]) await loadVariants(mid);
  };

  const useExtractRow = (row: any) => {
    if (isDuplicateRow(row)) return;

    setChassis(String(row?.chassis_number || ""));
    setEngine(String(row?.engine_number || ""));

    if (row?.ui_color) setColor(String(row.ui_color));
    else if (row?.color_code) setColor(String(row.color_code));
    else if (row?.color) setColor(String(row.color));

    if (row?.ui_model_id) setModelId(String(row.ui_model_id));
    if (row?.ui_variant_id) setVariantId(String(row.ui_variant_id));

    setOk("Auto-filled from PDF ✅");
  };

  const createAllFromExtract = async () => {
    if (!extractRows.length) return;

    const creatable = extractRows.filter((r) => !isDuplicateRow(r) && r.chassis_number && r.engine_number);
    const skipCount = extractRows.length - creatable.length;

    const okConfirm = window.confirm(
      `Create ${creatable.length} vehicles from this invoice?\nSkipped (duplicates/invalid): ${skipCount}`
    );
    if (!okConfirm) return;

    try {
      setSaving(true);
      setErr("");

      const vehicles = creatable.map((r) => ({
        chassis_number: String(r.chassis_number || "").trim(),
        engine_number: String(r.engine_number || "").trim(),
        model_id: r.ui_model_id ? Number(r.ui_model_id) : null,
        variant_id: r.ui_variant_id ? Number(r.ui_variant_id) : null,
        color: (r.ui_color || "").trim() || null, // dropdown code
        vehicle_model: [r.model, r.variant].filter(Boolean).join(" ").trim() || null,
      }));

      const url = debug ? "/api/vehicles/_invoice/create-bulk?debug=1" : "/api/vehicles/_invoice/create-bulk";

      const res = await api.post(url, {
        contact_id: contactId.trim() ? Number(contactId.trim()) : null,
        vehicle_make: make.trim() ? make.trim() : "Hero",
        vehicles,
      });

      const inserted = Number(res.data?.inserted || 0);
      const skipped = Number(res.data?.skipped || 0);

      alert(`Inserted: ${inserted}\nSkipped (Duplicate/Invalid): ${skipped}`);
      router.push("/vehicles");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Create all failed");
    } finally {
      setSaving(false);
    }
  };

  // ---------------- NEW: Manual Multi-Add actions ----------------
  const addManualToList = async () => {
    setErr("");
    setOk("");

    const c = normalizedChassis;
    const e = normalizedEngine;

    if (!c) return setErr("Chassis number is required");
    if (!e) return setErr("Engine number is required");

    // prevent duplicates inside pending list
    const dupLocal = manualRows.some(
      (r) => normalizeStr(r.chassis_number) === normalizeStr(c) || normalizeStr(r.engine_number) === normalizeStr(e)
    );
    if (dupLocal) return setErr("This chassis/engine is already in the pending list.");

    const mid = Number(modelId || 0);
    if (mid > 0 && !variantsByModel[mid]) await loadVariants(mid);

    const newRow: ManualRow = {
      _k: uniqKey(),
      chassis_number: c,
      engine_number: e,
      ui_model_id: modelId || "",
      ui_variant_id: variantId || "",
      ui_color: color || "",
    };

    setManualRows((prev) => [...prev, newRow]);

    // clear inputs for next entry
    setChassis("");
    setEngine("");
    setVariantId("");
    setOk("Added to list ✅");
  };

  const removeManualRow = (k: string) => {
    setManualRows((prev) => prev.filter((x) => x._k !== k));
  };

  const updateManualRow = async (k: string, patch: Partial<ManualRow>) => {
    // if changing model, reset variant and ensure variants loaded
    if (patch.ui_model_id !== undefined) {
      const mid = Number(patch.ui_model_id || 0);
      if (mid > 0 && !variantsByModel[mid]) await loadVariants(mid);
      patch.ui_variant_id = "";
    }

    setManualRows((prev) => prev.map((x) => (x._k === k ? { ...x, ...patch } : x)));
  };

  const saveManualAll = async () => {
    setErr("");
    setOk("");

    // include current typed vehicle too if filled and not already added
    const currentReady = normalizedChassis && normalizedEngine;

    const vehiclesFromList = manualRows.map((r) => ({
      chassis_number: String(r.chassis_number || "").trim(),
      engine_number: String(r.engine_number || "").trim(),
      model_id: r.ui_model_id ? Number(r.ui_model_id) : null,
      variant_id: r.ui_variant_id ? Number(r.ui_variant_id) : null,
      color: (r.ui_color || "").trim() || null,
      vehicle_model: null,
    }));

    const vehicles = [...vehiclesFromList];

    if (currentReady) {
      const already = vehicles.some(
        (v) =>
          normalizeStr(v.chassis_number) === normalizeStr(normalizedChassis) ||
          normalizeStr(v.engine_number) === normalizeStr(normalizedEngine)
      );
      if (!already) {
        vehicles.push({
          chassis_number: normalizedChassis,
          engine_number: normalizedEngine,
          model_id: modelId ? Number(modelId) : null,
          variant_id: variantId ? Number(variantId) : null,
          color: color.trim() ? color.trim() : null,
          vehicle_model: null,
        });
      }
    }

    if (!vehicles.length) return setErr("Add at least one vehicle to save.");

    const okConfirm = window.confirm(`Save ${vehicles.length} vehicles now? (Duplicates will be skipped)`);
    if (!okConfirm) return;

    try {
      setSaving(true);

      // ✅ use safe bulk endpoint if available
      const url = debug ? "/api/vehicles/_invoice/create-bulk?debug=1" : "/api/vehicles/_invoice/create-bulk";
      const res = await api.post(url, {
        contact_id: contactId.trim() ? Number(contactId.trim()) : null,
        vehicle_make: make.trim() ? make.trim() : "Hero",
        vehicles,
      });

      const inserted = Number(res.data?.inserted || 0);
      const skipped = Number(res.data?.skipped || 0);

      alert(`Inserted: ${inserted}\nSkipped (Duplicate/Invalid): ${skipped}`);
      router.push("/vehicles");
    } catch (e: any) {
      // fallback: old logic (create one-by-one)
      try {
        let done = 0;
        let failed = 0;
        let skipped = 0;

        for (const v of vehicles) {
          try {
            await api.post("/api/vehicles", {
              contact_id: contactId.trim() ? Number(contactId.trim()) : null,
              chassis_number: v.chassis_number,
              engine_number: v.engine_number,
              model_id: v.model_id,
              variant_id: v.variant_id,
              vehicle_make: make.trim() ? make.trim() : "Hero",
              color: v.color,
              vehicle_model: null,
            });
            done++;
          } catch (err2: any) {
            const msg = String(err2?.response?.data?.message || "").toLowerCase();
            if (msg.includes("duplicate")) skipped++;
            else failed++;
          }
        }

        alert(`Inserted: ${done}\nSkipped (Duplicate): ${skipped}\nFailed: ${failed}`);
        router.push("/vehicles");
      } catch (e2: any) {
        setErr(e2?.response?.data?.message || "Bulk save failed");
      }
    } finally {
      setSaving(false);
    }
  };

  // ---------------- submit single (old logic) ----------------
  const resetForm = () => {
    setContactId("");
    setChassis("");
    setEngine("");
    setColor("");
    if (makeOptions.length > 0) setMake(makeOptions[0].value);
    setModelId("");
    setVariantId("");
    setVariants([]);
    setErr("");
    setOk("");
    setExtract(null);
    setExtractRows([]);
    setExtractDebug(null);
    setManualRows([]);
  };

  const createVehicle = async () => {
    setErr("");
    setOk("");

    if (!normalizedChassis) return setErr("Chassis number is required");
    if (!normalizedEngine) return setErr("Engine number is required");

    const payload: any = {
      contact_id: contactId.trim() ? Number(contactId.trim()) : null,
      chassis_number: normalizedChassis,
      engine_number: normalizedEngine,
      vehicle_make: make.trim() ? make.trim() : null,
      color: color.trim() ? color.trim() : null,
      model_id: modelId ? Number(modelId) : null,
      variant_id: variantId ? Number(variantId) : null,
    };

    const selectedModel = models.find((m) => String(m.id) === String(modelId));
    const selectedVariant = variants.find((v) => String(v.id) === String(variantId));
    if (!payload.vehicle_model) {
      const label = [selectedModel?.model_name, selectedVariant?.variant_name].filter(Boolean).join(" ");
      payload.vehicle_model = label || null;
    }

    setSaving(true);
    try {
      await api.post("/api/vehicles", payload);
      setOk("Vehicle saved ✅");

      if (saveAndAddAnother) {
        setChassis("");
        setEngine("");
        setVariantId("");
        setOk("Saved ✅ Add next vehicle");
      } else {
        router.push("/vehicles");
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Failed to create vehicle";
      const lower = String(msg).toLowerCase();
      if (lower.includes("duplicate") || lower.includes("er_dup_entry")) {
        setErr("Duplicate chassis/engine found. This vehicle already exists.");
      } else {
        setErr(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <AuthGuard>
      <div className="p-6">
        {!permsLoading && !canCreate ? (
          <div className="bg-white p-6 rounded-xl shadow">
            <h1 className="text-xl font-bold">Add Vehicle</h1>
            <p className="mt-2 text-gray-600">No permission.</p>
            <div className="mt-4">
              <Link className="px-4 py-2 border rounded-lg" href="/vehicles">
                Back
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold">Add Vehicle</h1>
                <p className="text-sm text-gray-500">
                  Add single vehicle by UI. For bulk, use Invoice PDF or Excel Import on Vehicles page.
                </p>
                {debug ? (
                  <div className="mt-1 text-xs text-blue-700">
                    Debug mode enabled (<span className="font-mono">?debug=1</span>)
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Link className="px-4 py-2 border rounded-lg" href="/vehicles">
                  Back
                </Link>
              </div>
            </div>

            {/* ✅ Invoice PDF Upload */}
            <div className="mt-6 border rounded-xl p-4 bg-gray-50">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <div className="font-semibold">Invoice PDF → Auto Fill</div>
                  <div className="text-sm text-gray-600">
                    Upload invoice PDF and auto-extract chassis/engine + detect model/variant/color + duplicates.
                  </div>
                </div>

                <label className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50 cursor-pointer">
                  {pdfLoading ? "Extracting..." : "Upload PDF"}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const input = e.currentTarget;
                      const f = input.files?.[0];
                      if (!f) return;
                      await extractFromPdf(f);
                      input.value = "";
                    }}
                  />
                </label>
              </div>

              {extract?.raw_hint ? <div className="mt-3 text-sm text-amber-700">{extract.raw_hint}</div> : null}

              {extract ? (
                <div className="mt-4">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">Invoice:</span> {extract.invoice_number || "-"}{" "}
                    <span className="ml-3 font-medium">Date:</span> {extract.invoice_date || "-"}
                  </div>
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">Customer:</span> {extract.customer_name || "-"}{" "}
                    <span className="ml-3 font-medium">Phone:</span> {extract.customer_phone || "-"}
                  </div>

                  <div className="mt-3 overflow-x-auto border rounded-lg bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 border-b">Status</th>
                          <th className="px-3 py-2 border-b">Model</th>
                          <th className="px-3 py-2 border-b">Variant</th>
                          <th className="px-3 py-2 border-b">Color</th>
                          <th className="px-3 py-2 border-b">Engine</th>
                          <th className="px-3 py-2 border-b">Chassis</th>
                          <th className="px-3 py-2 border-b text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractRows.length ? (
                          extractRows.map((r, idx) => {
                            const dup = isDuplicateRow(r);
                            const rowBg = dup ? "bg-red-50" : "hover:bg-gray-50";

                            const mid = Number(r.ui_model_id || 0);
                            const vlist = mid > 0 ? variantsByModel[mid] || [] : [];

                            return (
                              <tr key={idx} className={rowBg}>
                                <td className="px-3 py-2 border-b whitespace-nowrap">
                                  {r.status?.code === "NEW" ? (
                                    <span className="text-green-700 font-medium">🟢 New</span>
                                  ) : r.status?.code === "UNLINKED" ? (
                                    <span className="text-amber-700 font-medium">🟡 Unlinked</span>
                                  ) : r.status?.code === "SOLD" ? (
                                    <span className="text-blue-700 font-medium">🔵 Sold</span>
                                  ) : (
                                    <span className="text-red-700 font-medium">🔴 Exists</span>
                                  )}
                                  <div className="text-xs text-gray-600">{r.status?.label || "-"}</div>
                                </td>

                                <td className="px-3 py-2 border-b">
                                  <select
                                    value={r.ui_model_id}
                                    onChange={(e) => onRowModelChange(idx, e.target.value)}
                                    className="w-44 border rounded-lg px-2 py-1 bg-white"
                                    disabled={loadingCatalog || dup}
                                  >
                                    <option value="">Other</option>
                                    {models.map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.model_name}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="text-xs text-gray-500 mt-1">{r.model || "-"}</div>
                                </td>

                                <td className="px-3 py-2 border-b">
                                  <select
                                    value={r.ui_variant_id}
                                    onChange={(e) => updateExtractRow(idx, { ui_variant_id: e.target.value })}
                                    className="w-44 border rounded-lg px-2 py-1 bg-white"
                                    disabled={loadingCatalog || dup || !r.ui_model_id}
                                  >
                                    <option value="">Other</option>
                                    {vlist.map((v) => (
                                      <option key={v.id} value={v.id}>
                                        {v.variant_name}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="text-xs text-gray-500 mt-1">{r.variant || "-"}</div>
                                </td>

                                <td className="px-3 py-2 border-b">
                                  <select
                                    value={r.ui_color}
                                    onChange={(e) => updateExtractRow(idx, { ui_color: e.target.value })}
                                    className="w-44 border rounded-lg px-2 py-1 bg-white"
                                    disabled={dup}
                                  >
                                    <option value="">--</option>
                                    {colorOptions.map((c) => (
                                      <option key={c.id} value={c.value}>
                                        {formatColorLabel(c)}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {r.color ? r.color : "-"}
                                    {r.color_code ? ` (${r.color_code})` : ""}
                                  </div>
                                </td>

                                <td className="px-3 py-2 border-b font-mono">{r.engine_number || "-"}</td>
                                <td className="px-3 py-2 border-b font-mono">{r.chassis_number || "-"}</td>

                                <td className="px-3 py-2 border-b text-right">
                                  <button
                                    type="button"
                                    onClick={() => useExtractRow(r)}
                                    className="px-3 py-1.5 border rounded-lg disabled:opacity-50"
                                    disabled={dup}
                                  >
                                    Use
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-3 py-3 text-gray-500">
                              No vehicle rows extracted.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {extractRows.length ? (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={createAllFromExtract}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        disabled={saving}
                      >
                        Create All Vehicles
                      </button>
                      <button type="button" onClick={() => setExtract(null)} className="px-4 py-2 border rounded-lg">
                        Clear Extract
                      </button>
                    </div>
                  ) : null}

                  {debug && extractDebug ? (
                    <div className="mt-4 border rounded-lg bg-white p-3">
                      <div className="font-semibold">Debug Output</div>
                      <pre className="text-xs mt-2 whitespace-pre-wrap break-words">{JSON.stringify(extractDebug, null, 2)}</pre>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {err && <div className="mt-4 text-sm text-red-600">{err}</div>}
            {ok && <div className="mt-4 text-sm text-green-700">{ok}</div>}

            {/* ---------------- Manual Multi-Add Form ---------------- */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Contact ID (optional)</label>
                <input
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  placeholder="Leave empty to keep vehicle unlinked"
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">You can link later by opening Contact and attaching the vehicle.</p>
              </div>

              <div>
                <label className="text-sm font-medium">Make</label>
                <select value={make} onChange={(e) => setMake(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2">
                  <option value="">-- Select Make --</option>
                  {makeOptions.map((m) => (
                    <option key={m.id} value={m.value}>
                      {m.value}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Chassis Number <span className="text-red-600">*</span>
                </label>
                <input
                  value={chassis}
                  onChange={(e) => setChassis(e.target.value)}
                  placeholder="Enter chassis number"
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Engine Number <span className="text-red-600">*</span>
                </label>
                <input value={engine} onChange={(e) => setEngine(e.target.value)} placeholder="Enter engine number" className="mt-1 w-full border rounded-lg px-3 py-2" />
              </div>

              <div>
                <label className="text-sm font-medium">Model (Catalog)</label>
                <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" disabled={loadingCatalog}>
                  <option value="">Other</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.model_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Variant (Catalog)</label>
                <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" disabled={loadingCatalog || !modelId}>
                  <option value="">Other</option>
                  {(variantsByModel[Number(modelId || 0)] || []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.variant_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Color</label>
                <select value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2">
                  <option value="">-- Select Color --</option>
                  {colorOptions.map((c) => (
                    <option key={c.id} value={c.value}>
                      {formatColorLabel(c)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Tip: Stored value remains code (BKB/BKG/BHG). Label is just display.
                </p>
              </div>
            </div>

            {/* ✅ plus button row */}
            <div className="mt-4 flex gap-2 flex-wrap items-center">
              <button
                type="button"
                onClick={addManualToList}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                disabled={saving}
                title="Add this vehicle to pending list"
              >
                ➕ Add to List
              </button>

              <button
                type="button"
                onClick={saveManualAll}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={saving}
                title="Save all pending vehicles (duplicates skipped)"
              >
                ✅ Save All (Bulk)
              </button>

              <label className="flex items-center gap-2 text-sm ml-2">
                <input type="checkbox" checked={saveAndAddAnother} onChange={(e) => setSaveAndAddAnother(e.target.checked)} />
                (Old) Save single vehicle & add another
              </label>
            </div>

            {/* Pending list table */}
            {manualRows.length ? (
              <div className="mt-4 border rounded-xl bg-white overflow-x-auto">
                <div className="px-4 py-3 border-b font-semibold">Pending Vehicles (Manual)</div>
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 border-b">Chassis</th>
                      <th className="px-3 py-2 border-b">Engine</th>
                      <th className="px-3 py-2 border-b">Model</th>
                      <th className="px-3 py-2 border-b">Variant</th>
                      <th className="px-3 py-2 border-b">Color</th>
                      <th className="px-3 py-2 border-b text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualRows.map((r) => {
                      const mid = Number(r.ui_model_id || 0);
                      const vlist = mid > 0 ? variantsByModel[mid] || [] : [];

                      return (
                        <tr key={r._k} className="hover:bg-gray-50">
                          <td className="px-3 py-2 border-b font-mono">{r.chassis_number}</td>
                          <td className="px-3 py-2 border-b font-mono">{r.engine_number}</td>

                          <td className="px-3 py-2 border-b">
                            <select
                              value={r.ui_model_id}
                              onChange={(e) => updateManualRow(r._k, { ui_model_id: e.target.value })}
                              className="border rounded-lg px-2 py-1"
                              disabled={saving}
                            >
                              <option value="">Other</option>
                              {models.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.model_name}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="px-3 py-2 border-b">
                            <select
                              value={r.ui_variant_id}
                              onChange={(e) => updateManualRow(r._k, { ui_variant_id: e.target.value })}
                              className="border rounded-lg px-2 py-1"
                              disabled={saving || !r.ui_model_id}
                            >
                              <option value="">Other</option>
                              {vlist.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.variant_name}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="px-3 py-2 border-b">
                            <select
                              value={r.ui_color}
                              onChange={(e) => updateManualRow(r._k, { ui_color: e.target.value })}
                              className="border rounded-lg px-2 py-1"
                              disabled={saving}
                            >
                              <option value="">--</option>
                              {colorOptions.map((c) => (
                                <option key={c.id} value={c.value}>
                                  {formatColorLabel(c)}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="px-3 py-2 border-b text-right">
                            <button
                              type="button"
                              onClick={() => removeManualRow(r._k)}
                              className="px-3 py-1.5 border rounded-lg"
                              disabled={saving}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {/* Old single save buttons (still available) */}
            <div className="mt-6 flex items-center justify-end gap-2 flex-wrap">
              <button onClick={resetForm} className="px-4 py-2 border rounded-lg" disabled={saving}>
                Clear
              </button>
              <button
                onClick={createVehicle}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={saving}
                title="Old single-create button (still supported)"
              >
                {saving ? "Saving..." : "Save Vehicle"}
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}