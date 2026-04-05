"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";

type Purchase = {
  id: number;
  purchase_from: string | null;
  invoice_number: string | null;
  invoice_date?: string | null;
  purchase_date: string | null;
  purchase_amount: number | null;
  notes: string | null;
  created_at: string | null;
};

type Item = {
  id: number;
  contact_vehicle_id: number | null;
  engine_number: string | null;
  chassis_number: string | null;
  color: string | null;
  purchase_price: number | null;
  status_code: string | null;
  existing_vehicle_id: number | null;
  existing_sale_id: number | null;
  model_name?: string | null;
  variant_name?: string | null;
  vehicle_name?: string | null;
};

type DDItem = {
  id: number;
  value: string;
  label?: string | null;
};

function statusMeta(code: string | null) {
  const c = String(code || "").trim().toLowerCase();

  if (c === "in_stock") return { label: "IN STOCK", dot: "🟢" };
  if (c === "new") return { label: "NEW", dot: "🟢" };
  if (c === "unlinked") return { label: "UNLINKED", dot: "🟡" };
  if (c === "sold") return { label: "SOLD", dot: "🔵" };
  if (c === "invalid") return { label: "INVALID", dot: "⚪" };
  if (c === "restorable") return { label: "RESTORABLE", dot: "🟠" };
  if (c === "duplicate") return { label: "DUPLICATE", dot: "🔴" };

  return {
    label: String(code || "-").replace(/_/g, " ").toUpperCase(),
    dot: "⚫",
  };
}

function compactVehicleName(item: Item) {
  const model = String(item.model_name || "").trim();
  const variant = String(item.variant_name || "").trim();

  if (model && variant) return `${model} / ${variant}`;
  if (item.vehicle_name && String(item.vehicle_name).trim()) return String(item.vehicle_name).trim();
  if (model) return model;
  if (variant) return variant;
  return "-";
}

export default function PurchasePrintPage() {
  const params = useParams();

  const { hasPermission, loading: permsLoading } = usePermissions();
  const user = getUser();
  const role = String(user?.role || "").toLowerCase();
  const isOwnerAdmin = role === "owner" || role === "admin";
  const canView =
    isOwnerAdmin || hasPermission("view_purchases") || hasPermission("manage_purchases");

  const id = Number((params as any)?.id || 0);

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [colorOptions, setColorOptions] = useState<DDItem[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const colorLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of colorOptions) {
      const key = String(c.value || "").trim().toUpperCase();
      const label = String(c.label || "").trim();
      if (key) map.set(key, label);
    }
    return map;
  }, [colorOptions]);

  const totals = useMemo(() => {
    const total = items.length;

    const inserted = items.filter((x) => {
      const c = String(x.status_code || "").trim().toLowerCase();
      return c === "in_stock" || c === "new";
    }).length;

    const skipped = items.filter((x) => {
      const c = String(x.status_code || "").trim().toLowerCase();
      return !(c === "in_stock" || c === "new");
    }).length;

    const sumPrice = items.reduce((s, r) => s + (Number(r.purchase_price || 0) || 0), 0);
    return { total, inserted, skipped, sumPrice };
  }, [items]);

  const formatColor = (value: string | null) => {
    const code = String(value || "").trim();
    if (!code) return "-";
    const label = colorLabelMap.get(code.toUpperCase());
    return label ? `${code} — ${label}` : code;
  };

  const loadColors = async () => {
    try {
      const res = await api.get("/api/dropdowns", {
        params: { types: "vehicle_color" },
      });

      const data = res.data?.data || {};
      const colors: DDItem[] = (data.vehicle_color || [])
        .map((x: any) => ({
          id: Number(x.id),
          value: String(x.value || ""),
          label: x.label ? String(x.label) : null,
        }))
        .filter((x: DDItem) => x.value);

      setColorOptions(colors);
    } catch {
      setColorOptions([]);
    }
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setErr("");
    try {
      const [purchaseRes] = await Promise.all([
        api.get(`/api/purchases/${id}`),
        loadColors(),
      ]);

      const data = purchaseRes.data?.data;
      setPurchase(data?.purchase || null);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTimeout(() => window.print(), 250);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to load purchase");
      setPurchase(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (permsLoading) return;
    if (!canView) return;
    load();
    // eslint-disable-next-line
  }, [id, permsLoading, canView]);

  return (
    <AuthGuard>
      <div className="p-4 bg-white text-black">
        {!permsLoading && !canView ? (
          <div className="bg-white p-6 rounded-xl shadow">
            <h1 className="text-xl font-bold">Print Purchase</h1>
            <p className="mt-2 text-gray-600">No permission.</p>
            <div className="mt-4">
              <Link className="px-4 py-2 border rounded-lg" href={`/purchases/${id}`}>
                Back
              </Link>
            </div>
          </div>
        ) : (
          <>
            <style>{`
              @page {
                size: A4 portrait;
                margin: 8mm;
              }

              @media print {
                .no-print {
                  display: none !important;
                }

                html, body {
                  background: white !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }

                body {
                  margin: 0 !important;
                }

                .print-wrap {
                  padding: 0 !important;
                }

                .print-card {
                  border: 1px solid #222 !important;
                  border-radius: 10px !important;
                  box-shadow: none !important;
                  break-inside: avoid;
                }

                .print-table {
                  width: 100% !important;
                  border-collapse: collapse !important;
                  table-layout: fixed !important;
                  font-size: 11px !important;
                }

                .print-table th,
                .print-table td {
                  border: 1px solid #333 !important;
                  padding: 4px 6px !important;
                  vertical-align: middle !important;
                  word-break: break-word !important;
                }

                .print-table thead {
                  display: table-header-group;
                }

                .print-table tr {
                  break-inside: avoid;
                  page-break-inside: avoid;
                }
              }
            `}</style>

            <div className="no-print mb-4 flex gap-2">
              <Link href={`/purchases/${id}`} className="px-4 py-2 border rounded-lg bg-white">
                Back
              </Link>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Print
              </button>
            </div>

            <div className="print-wrap max-w-[900px] mx-auto">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-[14px] font-semibold">Showroom DMS</div>
                  <div className="text-[30px] font-bold leading-tight">Purchase #{id}</div>
                </div>
                <div className="text-right text-[12px]">
                  <div>Date: {purchase?.purchase_date || "-"}</div>
                  <div>Printed: {new Date().toLocaleString()}</div>
                </div>
              </div>

              {err ? <div className="mb-3 text-sm text-red-600">{err}</div> : null}

              <div className="print-card border rounded-xl p-3 bg-gray-50 mb-3">
                {purchase ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                    <div>
                      <div className="text-gray-600">Purchase From</div>
                      <div className="font-semibold">{purchase.purchase_from || "-"}</div>
                    </div>

                    <div>
                      <div className="text-gray-600">Invoice No</div>
                      <div className="font-semibold">{purchase.invoice_number || "-"}</div>
                    </div>

                    <div>
                      <div className="text-gray-600">Purchase Date</div>
                      <div className="font-semibold">{purchase.purchase_date || "-"}</div>
                    </div>

                    <div>
                      <div className="text-gray-600">Amount</div>
                      <div className="font-semibold">
                        {purchase.purchase_amount != null
                          ? Number(purchase.purchase_amount).toFixed(2)
                          : "-"}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <div className="text-gray-600">Totals</div>
                      <div className="font-semibold">
                        Vehicles: {totals.total} | Inserted: {totals.inserted} | Skipped:{" "}
                        {totals.skipped} | Sum: {totals.sumPrice.toFixed(2)}
                      </div>
                    </div>

                    {purchase.notes ? (
                      <div className="col-span-2">
                        <div className="text-gray-600">Notes</div>
                        <div className="font-semibold whitespace-pre-wrap">{purchase.notes}</div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-gray-600">{loading ? "Loading..." : "No data."}</div>
                )}
              </div>

              <div className="print-card border rounded-xl overflow-hidden">
                <table className="print-table min-w-full text-sm table-fixed">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="w-[40px] text-left">#</th>
                      <th className="w-[180px] text-left">Model / Variant</th>
                      <th className="w-[180px] text-left">Chassis</th>
                      <th className="w-[160px] text-left">Engine</th>
                      <th className="w-[120px] text-left">Color</th>
                      <th className="w-[90px] text-right">Price</th>
                      <th className="w-[110px] text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length ? (
                      items.map((it, idx) => {
                        const st = statusMeta(it.status_code);
                        return (
                          <tr key={it.id}>
                            <td>{idx + 1}</td>
                            <td>{compactVehicleName(it)}</td>
                            <td>{it.chassis_number || "-"}</td>
                            <td>{it.engine_number || "-"}</td>
                            <td>{formatColor(it.color)}</td>
                            <td className="text-right">
                              {it.purchase_price != null ? Number(it.purchase_price).toFixed(2) : "-"}
                            </td>
                            <td>{st.dot} {st.label}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-3 py-4 text-gray-500">
                          {loading ? "Loading..." : "No items."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AuthGuard>
  );
}