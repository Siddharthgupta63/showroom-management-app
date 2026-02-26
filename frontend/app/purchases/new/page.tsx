"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";

type ModelRow = { id: number; model_name: string; is_active?: number };
type VariantRow = { id: number; model_id: number; variant_name: string; is_active?: number };

// ✅ CHANGE: DDItem now supports label (annotation)
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
  color?: string | null;
  color_code?: string | null;
  engine_number?: string | null;
  chassis_number?: string | null;
  model_id?: number | null;
  variant_id?: number | null;
  status?: VehicleStatus;
};

type ExtractResult = {
  invoice_number?: string | null;
  invoice_date?: string | null;
  vehicles: ExtractVehicleRow[];
  raw_hint?: string | null;
};

function normalizeStr(s: any) {
  return String(s ?? "").trim().toLowerCase();
}
function uniqKey() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function matchOption(val: string | null | undefined, options: DDItem[]) {
  const d = normalizeStr(val);
  if (!d) return "";
  const hit = options.find((o) => normalizeStr(o.value) === d);
  return hit ? hit.value : "";
}

// ✅ NEW helper: display text for color
function formatColorLabel(item: DDItem) {
  return item.label ? `${item.value} — ${item.label}` : item.value;
}

function statusBadge(s?: VehicleStatus | null) {
  const code = String(s?.code || "INVALID").toUpperCase();
  if (code === "NEW") return <span className="font-semibold text-green-700">🟢 NEW</span>;
  if (code === "UNLINKED") return <span className="font-semibold text-amber-700">🟡 UNLINKED</span>;
  if (code === "SOLD") return <span className="font-semibold text-blue-700">🔵 SOLD</span>;
  if (code === "DUPLICATE") return <span className="font-semibold text-red-700">🔴 DUPLICATE</span>;
  return <span className="font-semibold text-gray-700">⚪ INVALID</span>;
}

export default function NewPurchasePage() {
  const router = useRouter();
  const { hasPermission, loading: permsLoading } = usePermissions();

  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    setRole(String(u?.role || "").toLowerCase());
  }, []);

  const isOwnerAdmin = role === "owner" || role === "admin";
  // ✅ FIX: Purchases create is controlled by manage_purchases
  const canCreate = isOwnerAdmin || hasPermission("manage_purchases");

  // ---------------- purchase header ----------------
  const [purchaseFrom, setPurchaseFrom] = useState("");
  const [purchaseFromOptions, setPurchaseFromOptions] = useState<DDItem[]>([]);

  const [make, setMake] = useState("");
  const [makeOptions, setMakeOptions] = useState<DDItem[]>([]);

  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(""); // YYYY-MM-DD
  const [purchaseAmount, setPurchaseAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [contactId, setContactId] = useState<string>("");

  // ---------------- color + catalog ----------------
  const [colorOptions, setColorOptions] = useState<DDItem[]>([]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [variantsByModel, setVariantsByModel] = useState<Record<number, VariantRow[]>>({});
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // ---------------- manual input ----------------
  const [chassis, setChassis] = useState("");
  const [engine, setEngine] = useState("");
  const [modelId, setModelId] = useState<string>("");
  const [variantId, setVariantId] = useState<string>("");
  const [color, setColor] = useState<string>("");

  // inline preview for current input
  const [inputStatus, setInputStatus] = useState<VehicleStatus | null>(null);
  const inputTimer = useRef<any>(null);

  type ManualRow = {
    _k: string;
    chassis_number: string;
    engine_number: string;
    ui_model_id: string;
    ui_variant_id: string;
    ui_color: string;
    vehicle_model: string | null;
    status?: VehicleStatus | null;
  };

  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const listTimer = useRef<any>(null);

  // ---------------- PDF extract ----------------
  const [pdfLoading, setPdfLoading] = useState(false);
  const [extract, setExtract] = useState<ExtractResult | null>(null);

  // ---------------- UI state ----------------
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

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

  const loadVariants = async (mid: number) => {
    if (!mid) return;
    if (variantsByModel[mid]) return;

    setLoadingCatalog(true);
    try {
      const res = await tryGet(
        ["/api/vehicleCatalog/variants", "/api/vehicle-catalog/variants", "/api/admin/vehicle-catalog/variants"],
        { model_id: mid, includeInactive: 0 }
      );
      const list: any[] = res.data?.data || res.data || [];
      const cleaned = (list || [])
        .map((x: any) => ({
          id: Number(x.id),
          model_id: Number(x.model_id),
          variant_name: String(x.variant_name ?? x.name ?? ""),
        }))
        .filter((x: VariantRow) => x.id && x.variant_name);
      setVariantsByModel((prev) => ({ ...prev, [mid]: cleaned }));
    } catch {
      setVariantsByModel((prev) => ({ ...prev, [mid]: [] }));
    } finally {
      setLoadingCatalog(false);
    }
  };

  const loadDropdowns = async () => {
    try {
      const res = await api.get("/api/dropdowns", {
        params: { types: "vehicle_make,vehicle_color,vehicle_purchase_from" },
      });
      const data = res.data?.data || {};

      const makes: DDItem[] = (data.vehicle_make || [])
        .map((x: any) => ({ id: Number(x.id), value: String(x.value || "") }))
        .filter((x: DDItem) => x.value);

      // ✅ CHANGE: read label for vehicle_color
      const colors: DDItem[] = (data.vehicle_color || [])
        .map((x: any) => ({
          id: Number(x.id),
          value: String(x.value || ""),
          label: x.label ? String(x.label) : null,
        }))
        .filter((x: DDItem) => x.value);

      const purchaseFroms: DDItem[] = (data.vehicle_purchase_from || [])
        .map((x: any) => ({ id: Number(x.id), value: String(x.value || "") }))
        .filter((x: DDItem) => x.value);

      setMakeOptions(makes);
      setColorOptions(colors);
      setPurchaseFromOptions(purchaseFroms);

      if (!make && makes.length) setMake(makes[0].value);
      if (!purchaseFrom && purchaseFroms.length) setPurchaseFrom(purchaseFroms[0].value);
    } catch {
      setMakeOptions([]);
      setColorOptions([]);
      setPurchaseFromOptions([]);
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
    if (mid > 0) loadVariants(mid);
    // eslint-disable-next-line
  }, [modelId]);

  // ---------------- DUPLICATE PREVIEW (input row) ----------------
  const checkInputStatus = async (eng: string, chs: string) => {
    if (!eng || !chs) {
      setInputStatus(null);
      return;
    }
    try {
      const res = await api.post("/api/vehicles/_duplicate/status", { engine_number: eng, chassis_number: chs });
      setInputStatus(res.data?.status || null);
    } catch {
      // silent (don’t block typing)
    }
  };

  useEffect(() => {
    const eng = engine.trim();
    const chs = chassis.trim();

    if (inputTimer.current) clearTimeout(inputTimer.current);
    inputTimer.current = setTimeout(() => {
      checkInputStatus(eng, chs);
    }, 350);

    return () => {
      if (inputTimer.current) clearTimeout(inputTimer.current);
    };
    // eslint-disable-next-line
  }, [engine, chassis]);

  // ---------------- DUPLICATE PREVIEW (list rows bulk) ----------------
  const refreshListStatuses = async (rows: ManualRow[]) => {
    if (!rows.length) return;

    const payload = {
      vehicles: rows.map((r) => ({
        engine_number: r.engine_number,
        chassis_number: r.chassis_number,
      })),
    };

    try {
      const res = await api.post("/api/vehicles/_duplicate/status-bulk", payload);
      const data: Array<{ engine_number: string; chassis_number: string; status: VehicleStatus }> = res.data?.data || [];

      // build map by engine+chassis
      const map = new Map<string, VehicleStatus>();
      for (const it of data) {
        const key = `${String(it.engine_number || "").trim().toUpperCase()}__${String(it.chassis_number || "").trim().toUpperCase()}`;
        map.set(key, it.status);
      }

      setManualRows((prev) =>
        prev.map((r) => {
          const key = `${String(r.engine_number || "").trim().toUpperCase()}__${String(r.chassis_number || "").trim().toUpperCase()}`;
          const st = map.get(key) || r.status || null;
          return { ...r, status: st };
        })
      );
    } catch {
      // silent
    }
  };

  useEffect(() => {
    if (listTimer.current) clearTimeout(listTimer.current);
    listTimer.current = setTimeout(() => {
      refreshListStatuses(manualRows);
    }, 500);

    return () => {
      if (listTimer.current) clearTimeout(listTimer.current);
    };
    // eslint-disable-next-line
  }, [manualRows.length]);

  // ---------------- Manual list actions ----------------
  const addManualToList = async () => {
    setErr("");
    setOk("");

    const c = chassis.trim();
    const e = engine.trim();
    if (!c) return setErr("Chassis number is required");
    if (!e) return setErr("Engine number is required");

    // prevent local duplicates
    const dupLocal = manualRows.some(
      (r) => normalizeStr(r.chassis_number) === normalizeStr(c) || normalizeStr(r.engine_number) === normalizeStr(e)
    );
    if (dupLocal) return setErr("This chassis/engine is already in the pending list.");

    const mid = Number(modelId || 0);
    if (mid > 0) await loadVariants(mid);

    const modelName = mid ? models.find((m) => m.id === mid)?.model_name || "" : "";
    const vid = Number(variantId || 0);
    const variantName = mid && vid ? (variantsByModel[mid] || []).find((v) => v.id === vid)?.variant_name || "" : "";
    const vehicle_model = [modelName, variantName].filter(Boolean).join(" ").trim() || null;

    const newRow: ManualRow = {
      _k: uniqKey(),
      chassis_number: c,
      engine_number: e,
      ui_model_id: modelId || "",
      ui_variant_id: variantId || "",
      ui_color: color || "",
      vehicle_model,
      status: inputStatus || null, // show instant status (then bulk refresh keeps it accurate)
    };

    setManualRows((prev) => [...prev, newRow]);

    setChassis("");
    setEngine("");
    setVariantId("");
    setInputStatus(null);
    setOk("Added to list ✅");
  };

  const removeManualRow = (k: string) => setManualRows((prev) => prev.filter((x) => x._k !== k));

  const updateManualRow = async (k: string, patch: Partial<ManualRow>) => {
    if (patch.ui_model_id !== undefined) {
      const mid = Number(patch.ui_model_id || 0);
      if (mid > 0) await loadVariants(mid);
      patch.ui_variant_id = "";
    }
    setManualRows((prev) => prev.map((x) => (x._k === k ? { ...x, ...patch } : x)));
  };

  const mergeExtractIntoList = async () => {
    if (!extract?.vehicles?.length) return;

    const toAdd: ManualRow[] = [];

    for (const r of extract.vehicles) {
      const ch = String(r.chassis_number || "").trim();
      const en = String(r.engine_number || "").trim();
      if (!ch || !en) continue;

      const exists = manualRows.some(
        (m) => normalizeStr(m.chassis_number) === normalizeStr(ch) || normalizeStr(m.engine_number) === normalizeStr(en)
      );
      if (exists) continue;

      const mid = Number(r.model_id || 0);
      if (mid > 0) await loadVariants(mid);

      const modelName = mid ? models.find((m) => m.id === mid)?.model_name || "" : "";
      const vid = Number(r.variant_id || 0);
      const variantName = mid && vid ? (variantsByModel[mid] || []).find((v) => v.id === vid)?.variant_name || "" : "";

      const vehicle_model = String([r.model || modelName, r.variant || variantName].filter(Boolean).join(" ").trim() || "") || null;

      const byCode = matchOption(r.color_code || "", colorOptions);
      const byName = matchOption(r.color || "", colorOptions);

      toAdd.push({
        _k: uniqKey(),
        chassis_number: ch,
        engine_number: en,
        ui_model_id: r.model_id ? String(r.model_id) : "",
        ui_variant_id: r.variant_id ? String(r.variant_id) : "",
        ui_color: byCode || byName || "",
        vehicle_model,
        status: r.status || null, // initial preview from extractor (then bulk refresh reconfirms)
      });
    }

    if (!toAdd.length) {
      setOk("No new rows to merge ✅");
      return;
    }

    setManualRows((prev) => [...prev, ...toAdd]);
    setOk(`Merged ${toAdd.length} vehicles from PDF ✅`);
  };

  // ---------------- PDF extract ----------------
  const extractFromPdf = async (file: File) => {
    setPdfLoading(true);
    setExtract(null);
    setErr("");
    setOk("");

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await api.post("/api/vehicles/_invoice/extract", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data: ExtractResult | null = res.data?.data || null;
      setExtract(data);

      if (data?.invoice_number) setPurchaseInvoiceNo(String(data.invoice_number));
      if (data?.invoice_date && /^\d{2}\/\d{2}\/\d{4}$/.test(String(data.invoice_date))) {
        const [dd, mm, yyyy] = String(data.invoice_date).split("/");
        setPurchaseDate(`${yyyy}-${mm}-${dd}`);
      }

      setOk("PDF extracted ✅ (Click ‘Add Extracted Vehicles to List’)");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "PDF extraction failed");
    } finally {
      setPdfLoading(false);
    }
  };

  // ---------------- save purchase + create vehicles ----------------
  const savePurchase = async () => {
    setErr("");
    setOk("");

    if (!purchaseFrom.trim()) return setErr("Purchase From is required.");
    if (!manualRows.length) return setErr("Add at least 1 vehicle (manual or merge from PDF).");

    setSaving(true);
    try {
      const vehicles = manualRows.map((r) => ({
        chassis_number: String(r.chassis_number || "").trim(),
        engine_number: String(r.engine_number || "").trim(),
        model_id: r.ui_model_id ? Number(r.ui_model_id) : null,
        variant_id: r.ui_variant_id ? Number(r.ui_variant_id) : null,
        color: (r.ui_color || "").trim() || null,
        vehicle_model: r.vehicle_model || null,
      }));

      const payload = {
        purchase_from: purchaseFrom.trim(),
        invoice_number: purchaseInvoiceNo.trim() || null,
        invoice_date: extract?.invoice_date || null,
        purchase_date: purchaseDate || null,
        purchase_amount: purchaseAmount ? Number(purchaseAmount) : 0,
        notes: notes || null,
        contact_id: contactId.trim() ? Number(contactId.trim()) : null,
        vehicle_make: make.trim() ? make.trim() : "HERO BIKE",
        vehicles,
      };

      const res = await api.post("/api/purchases/from-invoice", payload);
      const summary = res.data?.summary;

      setOk(
        `Purchase saved ✅ Purchase ID: ${res.data?.purchase_id}. Inserted: ${summary?.inserted || 0}, Skipped: ${summary?.skipped || 0}`
      );

      router.push("/purchases");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to save purchase");
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
            <h1 className="text-xl font-bold">New Vehicle Purchase</h1>
            <p className="mt-2 text-gray-600">No permission.</p>
            <div className="mt-4">
              <Link className="px-4 py-2 border rounded-lg" href="/purchases">
                Back
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold">Vehicle Purchase</h1>
                <p className="text-sm text-gray-500">
                  Manual add has live duplicate preview (NEW / DUPLICATE / SOLD / UNLINKED).
                </p>
              </div>
              <div className="flex gap-2">
                <Link className="px-4 py-2 border rounded-lg" href="/purchases">
                  Back
                </Link>
              </div>
            </div>

            {/* Header */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Purchase From</label>
                <select
                  value={purchaseFrom}
                  onChange={(e) => setPurchaseFrom(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                >
                  <option value="">-- Select Purchase From --</option>
                  {purchaseFromOptions.map((x) => (
                    <option key={x.id} value={x.value}>
                      {x.value}
                    </option>
                  ))}
                </select>
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
                <label className="text-sm font-medium">Purchase Invoice Number</label>
                <input value={purchaseInvoiceNo} onChange={(e) => setPurchaseInvoiceNo(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </div>

              <div>
                <label className="text-sm font-medium">Purchase Date</label>
                <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </div>

              <div>
                <label className="text-sm font-medium">Purchase Amount</label>
                <input value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </div>

              <div>
                <label className="text-sm font-medium">Contact ID (optional)</label>
                <input value={contactId} onChange={(e) => setContactId(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" rows={3} />
              </div>
            </div>

            {/* Manual Add */}
            <div className="mt-6 border rounded-xl p-4 bg-gray-50">
              <div className="font-semibold">Add Vehicles (Manual) — Live Duplicate Preview</div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Chassis Number</label>
                  <input value={chassis} onChange={(e) => setChassis(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" />
                </div>

                <div>
                  <label className="text-sm font-medium">Engine Number</label>
                  <input value={engine} onChange={(e) => setEngine(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" />
                </div>

                <div>
                  <label className="text-sm font-medium">Model</label>
                  <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2">
                    <option value="">Other</option>
                    {models.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.model_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Variant</label>
                  <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" disabled={!modelId}>
                    <option value="">Other</option>
                    {(variantsByModel[Number(modelId || 0)] || []).map((v) => (
                      <option key={v.id} value={String(v.id)}>
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
                </div>

                <div className="flex items-end gap-3">
                  <button type="button" onClick={addManualToList} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                    + Add to List
                  </button>
                  <div className="text-sm">
                    <div className="text-gray-600">Preview</div>
                    <div>{engine.trim() && chassis.trim() ? statusBadge(inputStatus) : <span className="text-gray-500">Enter engine+chassis</span>}</div>
                    {inputStatus?.label ? <div className="text-xs text-gray-600">{inputStatus.label}</div> : null}
                  </div>
                </div>
              </div>

              {/* Pending list */}
              <div className="mt-4 overflow-x-auto border rounded-lg bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 border-b text-left">#</th>
                      <th className="px-3 py-2 border-b text-left">Status</th>
                      <th className="px-3 py-2 border-b text-left">Engine</th>
                      <th className="px-3 py-2 border-b text-left">Chassis</th>
                      <th className="px-3 py-2 border-b text-left">Model</th>
                      <th className="px-3 py-2 border-b text-left">Variant</th>
                      <th className="px-3 py-2 border-b text-left">Color</th>
                      <th className="px-3 py-2 border-b text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualRows.length ? (
                      manualRows.map((r, idx) => (
                        <tr key={r._k} className="hover:bg-gray-50">
                          <td className="px-3 py-2 border-b">{idx + 1}</td>

                          <td className="px-3 py-2 border-b">
                            {statusBadge(r.status)}
                            {r.status?.label ? <div className="text-xs text-gray-600">{r.status.label}</div> : null}
                          </td>

                          <td className="px-3 py-2 border-b font-mono">{r.engine_number}</td>
                          <td className="px-3 py-2 border-b font-mono">{r.chassis_number}</td>

                          <td className="px-3 py-2 border-b">
                            <select
                              value={r.ui_model_id}
                              onChange={(e) => updateManualRow(r._k, { ui_model_id: e.target.value })}
                              className="border rounded px-2 py-1"
                            >
                              <option value="">Other</option>
                              {models.map((m) => (
                                <option key={m.id} value={String(m.id)}>
                                  {m.model_name}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="px-3 py-2 border-b">
                            <select
                              value={r.ui_variant_id}
                              onChange={(e) => updateManualRow(r._k, { ui_variant_id: e.target.value })}
                              className="border rounded px-2 py-1"
                              disabled={!r.ui_model_id}
                            >
                              <option value="">Other</option>
                              {(variantsByModel[Number(r.ui_model_id || 0)] || []).map((v) => (
                                <option key={v.id} value={String(v.id)}>
                                  {v.variant_name}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="px-3 py-2 border-b">
                            <select
                              value={r.ui_color}
                              onChange={(e) => updateManualRow(r._k, { ui_color: e.target.value })}
                              className="border rounded px-2 py-1"
                            >
                              <option value="">--</option>
                              {colorOptions.map((c) => (
                                <option key={c.id} value={c.value}>
                                  {formatColorLabel(c)}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="px-3 py-2 border-b">
                            <button onClick={() => removeManualRow(r._k)} className="px-3 py-1 border rounded hover:bg-gray-50">
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-3 py-4 text-gray-500">
                          No vehicles added yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={savePurchase}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                  disabled={saving || !manualRows.length}
                >
                  {saving ? "Saving..." : "Save Purchase + Create Vehicles"}
                </button>
              </div>
            </div>

            {/* PDF extract (optional) */}
            <div className="mt-6 border rounded-xl p-4 bg-gray-50">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <div className="font-semibold">Purchase Invoice PDF → Auto Extract (Optional)</div>
                  <div className="text-sm text-gray-600">Extract vehicles then merge them into the manual list.</div>
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
                    <span className="ml-3 font-medium">Date:</span> {extract.invoice_date || "-"}{" "}
                    <span className="ml-3 font-medium">Rows:</span> {extract.vehicles?.length || 0}
                  </div>

                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button onClick={mergeExtractIntoList} className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50">
                      Add Extracted Vehicles to List
                    </button>
                    <button onClick={() => setExtract(null)} className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50">
                      Clear Extract
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {err && <div className="mt-4 text-sm text-red-600">{err}</div>}
            {ok && <div className="mt-4 text-sm text-green-700">{ok}</div>}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}