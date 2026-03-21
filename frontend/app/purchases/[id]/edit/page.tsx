"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";

type ModelRow = { id: number; model_name: string; is_active?: number };
type VariantRow = { id: number; model_id: number; variant_name: string; is_active?: number };
type DDItem = { id: number; value: string; label?: string | null };

type PurchaseForm = {
  purchase_from: string;
  transporter_name: string;
  lr_number: string;
  transport_vehicle_number: string;
  invoice_number: string;
  invoice_date: string;
  purchase_date: string;
  purchase_amount: string;
  notes: string;
};

type ItemRow = {
  id: number;
  engine_number: string;
  chassis_number: string;
  color: string;
  purchase_price: string;
  model_id: string;
  variant_id: string;
};

function normalizeDate(v: any) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  return s.slice(0, 10);
}

function normalizeStr(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

function formatColorLabel(item: DDItem) {
  return item.label ? `${item.value} — ${item.label}` : item.value;
}

export default function PurchaseEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number((params as any)?.id || 0);

  const { hasPermission, loading: permsLoading } = usePermissions();

  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState<PurchaseForm>({
    purchase_from: "",
    transporter_name: "",
    lr_number: "",
    transport_vehicle_number: "",
    invoice_number: "",
    invoice_date: "",
    purchase_date: "",
    purchase_amount: "",
    notes: "",
  });

  const [items, setItems] = useState<ItemRow[]>([]);

  const [purchaseFromOptions, setPurchaseFromOptions] = useState<DDItem[]>([]);
  const [transporterOptions, setTransporterOptions] = useState<DDItem[]>([]);
  const [colorOptions, setColorOptions] = useState<DDItem[]>([]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [variantsByModel, setVariantsByModel] = useState<Record<number, VariantRow[]>>({});

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    setRole(String(u?.role || "").toLowerCase());
  }, []);

  const isOwnerAdmin = role === "owner" || role === "admin";
  const canManage = isOwnerAdmin || hasPermission("manage_purchases");

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
    }
  };

  const loadVariants = async (mid: number) => {
    if (!mid) return;
    if (variantsByModel[mid]) return;

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
    }
  };

  const loadDropdowns = async () => {
    try {
      const res = await api.get("/api/dropdowns", {
        params: { types: "vehicle_color,vehicle_purchase_from,vehicle_transporter_name" },
      });
      const data = res.data?.data || {};

      const colors: DDItem[] = (data.vehicle_color || [])
        .map((x: any) => ({
          id: Number(x.id),
          value: String(x.value || ""),
          label: x.label ? String(x.label) : null,
        }))
        .filter((x: DDItem) => x.value);

      const purchaseFroms: DDItem[] = (data.vehicle_purchase_from || [])
        .map((x: any) => ({
          id: Number(x.id),
          value: String(x.value || ""),
        }))
        .filter((x: DDItem) => x.value);

      const transporters: DDItem[] = (data.vehicle_transporter_name || [])
        .map((x: any) => ({
          id: Number(x.id),
          value: String(x.value || ""),
        }))
        .filter((x: DDItem) => x.value);

      setColorOptions(colors);
      setPurchaseFromOptions(purchaseFroms);
      setTransporterOptions(transporters);
    } catch {
      setColorOptions([]);
      setPurchaseFromOptions([]);
      setTransporterOptions([]);
    }
  };

  const loadPurchase = async () => {
    if (!id) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.get(`/api/purchases/${id}`);
      const purchase = res.data?.data?.purchase;
      const itemRows = res.data?.data?.items || [];

      if (!purchase) {
        setError("Purchase not found");
        return;
      }

      setForm({
        purchase_from: String(purchase.purchase_from || ""),
        transporter_name: String(purchase.transporter_name || ""),
        lr_number: String(purchase.lr_number || ""),
        transport_vehicle_number: String(purchase.transport_vehicle_number || ""),
        invoice_number: String(purchase.invoice_number || ""),
        invoice_date: normalizeDate(purchase.invoice_date),
        purchase_date: normalizeDate(purchase.purchase_date),
        purchase_amount:
          purchase.purchase_amount != null ? String(purchase.purchase_amount) : "",
        notes: String(purchase.notes || ""),
      });

      const mappedItems: ItemRow[] = itemRows.map((it: any) => ({
        id: Number(it.id),
        engine_number: String(it.engine_number || ""),
        chassis_number: String(it.chassis_number || ""),
        color: String(it.color || ""),
        purchase_price: it.purchase_price != null ? String(it.purchase_price) : "",
        model_id: it.model_id != null ? String(it.model_id) : "",
        variant_id: it.variant_id != null ? String(it.variant_id) : "",
      }));

      setItems(mappedItems);

      const modelIds = Array.from(
        new Set(mappedItems.map((x) => Number(x.model_id || 0)).filter((x) => x > 0))
      );

      for (const mid of modelIds) {
        await loadVariants(mid);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load purchase");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
    loadDropdowns();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (permsLoading) return;

    if (!canManage) {
      router.replace(`/purchases/${id}`);
      return;
    }

    loadPurchase();
  }, [mounted, permsLoading, canManage, id]);

  const updateItem = async (index: number, patch: Partial<ItemRow>) => {
    const next = [...items];
    const current = { ...next[index], ...patch };

    if (patch.model_id !== undefined) {
      current.variant_id = "";
      const mid = Number(patch.model_id || 0);
      if (mid > 0) {
        await loadVariants(mid);
      }
    }

    next[index] = current;
    setItems(next);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const duplicateInPage = useMemo(() => {
    const seenEngine = new Set<string>();
    const seenChassis = new Set<string>();
    const issues: string[] = [];

    for (const row of items) {
      const e = normalizeStr(row.engine_number);
      const c = normalizeStr(row.chassis_number);

      if (!e) issues.push("Engine number is required for all items");
      if (!c) issues.push("Chassis number is required for all items");

      if (e) {
        if (seenEngine.has(e)) issues.push(`Duplicate engine in form: ${row.engine_number}`);
        seenEngine.add(e);
      }

      if (c) {
        if (seenChassis.has(c)) issues.push(`Duplicate chassis in form: ${row.chassis_number}`);
        seenChassis.add(c);
      }
    }

    return Array.from(new Set(issues));
  }, [items]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (!form.purchase_from.trim()) {
        throw new Error("Purchase From is required");
      }

      if (!form.purchase_date.trim()) {
        throw new Error("Purchase Date is required");
      }

      if (!items.length) {
        throw new Error("At least one item is required");
      }

      if (duplicateInPage.length) {
        throw new Error(duplicateInPage[0]);
      }

      await api.put(`/api/purchases/${id}`, {
        purchase_from: form.purchase_from,
        transporter_name: form.transporter_name || null,
        lr_number: form.lr_number || null,
        transport_vehicle_number: form.transport_vehicle_number || null,
        invoice_number: form.invoice_number,
        invoice_date: form.invoice_date || null,
        purchase_date: form.purchase_date,
        purchase_amount: form.purchase_amount,
        notes: form.notes,
        items: items.map((it) => ({
          id: it.id,
          engine_number: it.engine_number.trim(),
          chassis_number: it.chassis_number.trim(),
          color: it.color || null,
          purchase_price: it.purchase_price === "" ? null : Number(it.purchase_price),
          model_id: it.model_id ? Number(it.model_id) : null,
          variant_id: it.variant_id ? Number(it.variant_id) : null,
        })),
      });

      setSuccess("Purchase updated successfully");

      setTimeout(() => {
        router.push(`/purchases/${id}`);
      }, 700);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to update purchase");
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <AuthGuard>
      <div className="p-6">
        {!permsLoading && !canManage ? (
          <div className="bg-white p-6 rounded-xl shadow">
            <h1 className="text-xl font-bold">Edit Purchase</h1>
            <p className="mt-2 text-gray-600">No permission.</p>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex justify-between items-start flex-wrap gap-3 mb-6">
              <div>
                <h1 className="text-2xl font-bold">Edit Purchase #{id}</h1>
                <p className="text-sm text-gray-500">Update purchase header and item details</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/purchases/${id}`}
                  className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50"
                >
                  Back
                </Link>
              </div>
            </div>

            {loading ? (
              <div className="text-gray-600">Loading...</div>
            ) : (
              <form onSubmit={onSave} className="space-y-6">
                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
                    {error}
                  </div>
                ) : null}

                {success ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700 text-sm">
                    {success}
                  </div>
                ) : null}

                {duplicateInPage.length ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
                    {duplicateInPage[0]}
                  </div>
                ) : null}

                {/* Header */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purchase From
                    </label>
                    <select
                      value={form.purchase_from}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, purchase_from: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2"
                      required
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Transporter Name
                    </label>
                    <select
                      value={form.transporter_name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, transporter_name: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="">-- Select Transporter --</option>
                      {transporterOptions.map((x) => (
                        <option key={x.id} value={x.value}>
                          {x.value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      value={form.invoice_number}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, invoice_number: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      LR Number
                    </label>
                    <input
                      type="text"
                      value={form.lr_number}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, lr_number: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice Date
                    </label>
                    <input
                      type="date"
                      value={form.invoice_date}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, invoice_date: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purchase Date
                    </label>
                    <input
                      type="date"
                      value={form.purchase_date}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, purchase_date: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purchase Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.purchase_amount}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, purchase_amount: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vehicle Number (optional)
                    </label>
                    <input
                      type="text"
                      value={form.transport_vehicle_number}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          transport_vehicle_number: e.target.value,
                        }))
                      }
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                {/* Items */}
                <div className="border rounded-xl p-4 bg-gray-50">
                  <div className="font-semibold mb-4">Edit Purchase Items</div>

                  <div className="overflow-x-auto border rounded-lg bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 border-b text-left">#</th>
                          <th className="px-3 py-2 border-b text-left">Engine</th>
                          <th className="px-3 py-2 border-b text-left">Chassis</th>
                          <th className="px-3 py-2 border-b text-left">Model</th>
                          <th className="px-3 py-2 border-b text-left">Variant</th>
                          <th className="px-3 py-2 border-b text-left">Color</th>
                          <th className="px-3 py-2 border-b text-left">Price</th>
                          <th className="px-3 py-2 border-b text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length ? (
                          items.map((row, idx) => (
                            <tr key={row.id}>
                              <td className="px-3 py-2 border-b">{idx + 1}</td>

                              <td className="px-3 py-2 border-b">
                                <input
                                  value={row.engine_number}
                                  onChange={(e) =>
                                    updateItem(idx, { engine_number: e.target.value })
                                  }
                                  className="border rounded px-2 py-1 w-[180px]"
                                />
                              </td>

                              <td className="px-3 py-2 border-b">
                                <input
                                  value={row.chassis_number}
                                  onChange={(e) =>
                                    updateItem(idx, { chassis_number: e.target.value })
                                  }
                                  className="border rounded px-2 py-1 w-[220px]"
                                />
                              </td>

                              <td className="px-3 py-2 border-b">
                                <select
                                  value={row.model_id}
                                  onChange={(e) =>
                                    updateItem(idx, { model_id: e.target.value })
                                  }
                                  className="border rounded px-2 py-1 min-w-[160px]"
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
                                  value={row.variant_id}
                                  onChange={(e) =>
                                    updateItem(idx, { variant_id: e.target.value })
                                  }
                                  className="border rounded px-2 py-1 min-w-[160px]"
                                  disabled={!row.model_id}
                                >
                                  <option value="">Other</option>
                                  {(variantsByModel[Number(row.model_id || 0)] || []).map((v) => (
                                    <option key={v.id} value={String(v.id)}>
                                      {v.variant_name}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className="px-3 py-2 border-b">
                                <select
                                  value={row.color}
                                  onChange={(e) =>
                                    updateItem(idx, { color: e.target.value })
                                  }
                                  className="border rounded px-2 py-1 min-w-[150px]"
                                >
                                  <option value="">-- Select Color --</option>
                                  {colorOptions.map((c) => (
                                    <option key={c.id} value={c.value}>
                                      {formatColorLabel(c)}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className="px-3 py-2 border-b">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.purchase_price}
                                  onChange={(e) =>
                                    updateItem(idx, { purchase_price: e.target.value })
                                  }
                                  className="border rounded px-2 py-1 w-[110px]"
                                />
                              </td>

                              <td className="px-3 py-2 border-b">
                                <button
                                  type="button"
                                  onClick={() => removeItem(idx)}
                                  className="px-3 py-1 border rounded hover:bg-gray-50"
                                  disabled={items.length <= 1}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-3 py-4 text-gray-500">
                              No items found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>

                  <Link
                    href={`/purchases/${id}`}
                    className="px-5 py-2.5 rounded-lg border bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}