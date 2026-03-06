"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

export default function PurchaseViewPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number((params as any)?.id || 0);

  const { hasPermission, loading: permsLoading } = usePermissions();

  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    setRole(String(u?.role || "").toLowerCase());
  }, []);

  const isOwnerAdmin = role === "owner" || role === "admin";
  const canView =
    isOwnerAdmin || hasPermission("view_purchases") || hasPermission("manage_purchases");
  const canManage = isOwnerAdmin || hasPermission("manage_purchases");

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const counts = useMemo(() => {
    const total = items.length;
    const inserted = items.filter((x) => String(x.status_code || "").toUpperCase() === "NEW").length;
    const skipped = total - inserted;
    return { total, inserted, skipped };
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
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to load purchase");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    if (permsLoading) return;
    if (!canView) return;
    load();
  }, [mounted, id, permsLoading, canView]);

  const badge = (code: string | null) => {
    const c = String(code || "").toUpperCase();
    if (c === "NEW") return <span className="text-green-700 font-semibold">🟢 NEW</span>;
    if (c === "UNLINKED") return <span className="text-amber-700 font-semibold">🟡 UNLINKED</span>;
    if (c === "SOLD") return <span className="text-blue-700 font-semibold">🔵 SOLD</span>;
    if (c === "INVALID") return <span className="text-gray-700 font-semibold">⚪ INVALID</span>;
    return <span className="text-red-700 font-semibold">🔴 DUPLICATE</span>;
  };

  const rowBg = (code: string | null) => {
    const c = String(code || "").toUpperCase();
    if (c === "NEW") return "hover:bg-gray-50";
    if (c === "UNLINKED") return "bg-amber-50";
    if (c === "SOLD") return "bg-blue-50";
    if (c === "INVALID") return "bg-gray-50";
    return "bg-red-50";
  };

  if (!mounted) return null;

  return (
    <AuthGuard>
      <div className="p-6">
        {!permsLoading && !canView ? (
          <div className="bg-white p-6 rounded-xl shadow">
            <h1 className="text-xl font-bold">Purchase</h1>
            <p className="mt-2 text-gray-600">No permission.</p>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold">Purchase #{id}</h1>
                <p className="text-sm text-gray-500">Purchase details and vehicle status</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Link href="/purchases" className="px-4 py-2 border rounded-lg">
                  Back
                </Link>

                <Link
                  href={`/purchases/${id}/print`}
                  className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50"
                >
                  Print
                </Link>

                {canManage && (
                  <button
                    onClick={() => (window.location.href = `/api/purchases/${id}/_export-items`)}
                    className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50"
                  >
                    Export Items
                  </button>
                )}

                {canManage && (
                  <button
                    onClick={() => router.push("/purchases/new")}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    + New Purchase
                  </button>
                )}
              </div>
            </div>

            {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

            <div className="mt-5 border rounded-xl p-4 bg-gray-50 text-sm">
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
                    <div className="text-gray-600">Vehicles</div>
                    <div className="font-semibold">{counts.total}</div>
                  </div>

                  <div>
                    <div className="text-gray-600">Inserted / Skipped</div>
                    <div className="font-semibold">
                      <span className="text-green-700">{counts.inserted}</span> /{" "}
                      <span className="text-amber-700">{counts.skipped}</span>
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

            <div className="mt-4 overflow-x-auto border rounded-xl">
              <table className="min-w-full text-sm bg-white">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 border-b text-left">#</th>
                    <th className="px-3 py-2 border-b text-left">Chassis</th>
                    <th className="px-3 py-2 border-b text-left">Engine</th>
                    <th className="px-3 py-2 border-b text-left">Color</th>
                    <th className="px-3 py-2 border-b text-right">Price</th>
                    <th className="px-3 py-2 border-b text-left">Status</th>
                    <th className="px-3 py-2 border-b text-left">Existing IDs</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length ? (
                    items.map((it, idx) => (
                      <tr key={it.id} className={rowBg(it.status_code)}>
                        <td className="px-3 py-2 border-b">{idx + 1}</td>
                        <td className="px-3 py-2 border-b">{it.chassis_number || "-"}</td>
                        <td className="px-3 py-2 border-b">{it.engine_number || "-"}</td>
                        <td className="px-3 py-2 border-b">{it.color || "-"}</td>
                        <td className="px-3 py-2 border-b text-right">
                          {it.purchase_price != null ? Number(it.purchase_price).toFixed(2) : "-"}
                        </td>
                        <td className="px-3 py-2 border-b">{badge(it.status_code)}</td>
                        <td className="px-3 py-2 border-b text-xs text-gray-600">
                          {it.existing_vehicle_id ? `Vehicle: ${it.existing_vehicle_id}` : "-"}
                          {it.existing_sale_id ? ` | Sale: ${it.existing_sale_id}` : ""}
                        </td>
                      </tr>
                    ))
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
        )}
      </div>
    </AuthGuard>
  );
}