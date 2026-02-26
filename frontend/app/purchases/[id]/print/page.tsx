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
};

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
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const totals = useMemo(() => {
    const total = items.length;
    const inserted = items.filter((x) => String(x.status_code || "").toUpperCase() === "NEW").length;
    const skipped = total - inserted;
    const sumPrice = items.reduce((s, r) => s + (Number(r.purchase_price || 0) || 0), 0);
    return { total, inserted, skipped, sumPrice };
  }, [items]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setErr("");
    try {
      const res = await api.get(`/api/purchases/${id}`);
      const data = res.data?.data;
      setPurchase(data?.purchase || null);
      setItems(data?.items || []);
      setTimeout(() => window.print(), 300);
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

  const badge = (code: string | null) => {
    const c = String(code || "").toUpperCase();
    if (c === "NEW") return "🟢 NEW";
    if (c === "UNLINKED") return "🟡 UNLINKED";
    if (c === "SOLD") return "🔵 SOLD";
    if (c === "INVALID") return "⚪ INVALID";
    return "🔴 DUPLICATE";
  };

  return (
    <AuthGuard>
      <div className="p-6 bg-white">
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
              @media print {
                .no-print { display: none !important; }
                body { background: white; }
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

            <div className="text-2xl font-bold">Purchase #{id}</div>
            {err ? <div className="mt-2 text-sm text-red-600">{err}</div> : null}

            <div className="mt-4 border rounded-xl p-4 bg-gray-50 text-sm">
              {purchase ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      {purchase.purchase_amount != null ? Number(purchase.purchase_amount).toFixed(2) : "-"}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-600">Totals</div>
                    <div className="font-semibold">
                      Vehicles: {totals.total} | Inserted: {totals.inserted} | Skipped: {totals.skipped} | Sum:{" "}
                      {totals.sumPrice.toFixed(2)}
                    </div>
                  </div>

                  {purchase.notes ? (
                    <div className="md:col-span-2">
                      <div className="text-gray-600">Notes</div>
                      <div className="font-semibold whitespace-pre-wrap">{purchase.notes}</div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-gray-600">{loading ? "Loading..." : "No data."}</div>
              )}
            </div>

            <div className="mt-4 border rounded-xl overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 border-b text-left">#</th>
                    <th className="px-3 py-2 border-b text-left">Chassis</th>
                    <th className="px-3 py-2 border-b text-left">Engine</th>
                    <th className="px-3 py-2 border-b text-left">Color</th>
                    <th className="px-3 py-2 border-b text-right">Price</th>
                    <th className="px-3 py-2 border-b text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length ? (
                    items.map((it, idx) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2 border-b">{idx + 1}</td>
                        <td className="px-3 py-2 border-b">{it.chassis_number || "-"}</td>
                        <td className="px-3 py-2 border-b">{it.engine_number || "-"}</td>
                        <td className="px-3 py-2 border-b">{it.color || "-"}</td>
                        <td className="px-3 py-2 border-b text-right">
                          {it.purchase_price != null ? Number(it.purchase_price).toFixed(2) : "-"}
                        </td>
                        <td className="px-3 py-2 border-b">{badge(it.status_code)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-gray-500">
                        {loading ? "Loading..." : "No items."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AuthGuard>
  );
}