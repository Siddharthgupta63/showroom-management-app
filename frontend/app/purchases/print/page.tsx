"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";

type PurchaseRow = {
  id: number;
  purchase_from: string | null;
  invoice_number: string | null;
  purchase_date: string | null;
  purchase_amount: number | null;
  total_items: number;
  inserted_items: number;
  skipped_items: number;
  created_at: string | null;
};

type DDItem = { id: number; value: string };

export default function PurchasesPrintSummaryPage() {
  const sp = useSearchParams();

  const { hasPermission, loading: permsLoading } = usePermissions();
  const user = getUser();
  const role = String(user?.role || "").toLowerCase();
  const isOwnerAdmin = role === "owner" || role === "admin";
  const canView =
    isOwnerAdmin || hasPermission("view_purchases") || hasPermission("manage_purchases");

  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // filters (read initial from URL)
  const [q, setQ] = useState(sp?.get("q") || "");
  const [from, setFrom] = useState(sp?.get("from") || "");
  const [to, setTo] = useState(sp?.get("to") || "");
  const [purchaseFrom, setPurchaseFrom] = useState(sp?.get("purchase_from") || "");
  const [purchaseFromOptions, setPurchaseFromOptions] = useState<DDItem[]>([]);

  const totals = useMemo(() => {
    const totalPurchases = rows.length;
    const totalAmount = rows.reduce((s, r) => s + (Number(r.purchase_amount || 0) || 0), 0);
    const totalVehicles = rows.reduce((s, r) => s + (Number(r.total_items || 0) || 0), 0);
    const inserted = rows.reduce((s, r) => s + (Number(r.inserted_items || 0) || 0), 0);
    const skipped = rows.reduce((s, r) => s + (Number(r.skipped_items || 0) || 0), 0);
    return { totalPurchases, totalAmount, totalVehicles, inserted, skipped };
  }, [rows]);

  const loadPurchaseFromOptions = async () => {
    try {
      const res = await api.get("/api/dropdowns", {
        params: { types: "vehicle_purchase_from" },
      });
      const data = res.data?.data || {};
      const opts: DDItem[] = (data.vehicle_purchase_from || [])
        .map((x: any) => ({ id: Number(x.id), value: String(x.value ?? x.label ?? x.name ?? "") }))
        .filter((x: DDItem) => x.value);
      setPurchaseFromOptions(opts);
    } catch {
      setPurchaseFromOptions([]);
    }
  };

  const load = async (autoPrint = false) => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/api/purchases", {
        params: {
          page: 1,
          pageSize: 5000,
          q: q.trim() || undefined,
          from: from || undefined,
          to: to || undefined,
          purchase_from: purchaseFrom || undefined,
        },
      });
      setRows(res.data?.data || []);

      if (autoPrint) setTimeout(() => window.print(), 300);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to load purchases");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchaseFromOptions();
    if (permsLoading) return;
    if (!canView) return;
    load(true);
    // eslint-disable-next-line
  }, [permsLoading, canView]);

  const filterLabel = useMemo(() => {
    const parts: string[] = [];
    if (purchaseFrom) parts.push(`From: ${purchaseFrom}`);
    if (from) parts.push(`Date >= ${from}`);
    if (to) parts.push(`Date <= ${to}`);
    if (q.trim()) parts.push(`Search: ${q.trim()}`);
    return parts.length ? parts.join(" | ") : "All";
  }, [purchaseFrom, from, to, q]);

  return (
    <AuthGuard>
      <div className="p-6 bg-white">
        {!permsLoading && !canView ? (
          <div className="bg-white p-6 rounded-xl shadow">
            <h1 className="text-xl font-bold">Print Purchases Summary</h1>
            <p className="mt-2 text-gray-600">No permission.</p>
            <div className="mt-4">
              <Link className="px-4 py-2 border rounded-lg" href="/purchases">
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

            {/* Filter controls (hidden in print) */}
            <div className="no-print mb-4 border rounded-xl p-4 bg-gray-50">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-semibold">Print Purchases Summary (Filtered)</div>
                <div className="flex gap-2">
                  <Link href="/purchases" className="px-4 py-2 border rounded-lg bg-white">
                    Back
                  </Link>
                  <button
                    onClick={() => load(true)}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    disabled={loading}
                  >
                    Print
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-sm font-medium">Search</label>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    placeholder="supplier / invoice / id"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Purchase From</label>
                  <select
                    value={purchaseFrom}
                    onChange={(e) => setPurchaseFrom(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">All</option>
                    {purchaseFromOptions.map((x) => (
                      <option key={x.id} value={x.value}>
                        {x.value}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">From</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">To</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => load(false)}
                  className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50"
                  disabled={loading}
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    setQ("");
                    setFrom("");
                    setTo("");
                    setPurchaseFrom("");
                    setTimeout(() => load(false), 0);
                  }}
                  className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50"
                  disabled={loading}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Report header */}
            <div className="mb-3">
              <div className="text-2xl font-bold">Vehicle Purchases Summary</div>
              <div className="text-sm text-gray-600">Filter: {filterLabel}</div>
              <div className="text-sm text-gray-600">
                Totals — Purchases: <b>{totals.totalPurchases}</b>, Amount:{" "}
                <b>{totals.totalAmount.toFixed(2)}</b>, Vehicles: <b>{totals.totalVehicles}</b>, Inserted:{" "}
                <b>{totals.inserted}</b>, Skipped: <b>{totals.skipped}</b>
              </div>
            </div>

            {err ? <div className="text-sm text-red-600">{err}</div> : null}

            <div className="border rounded-xl overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 border-b text-left">ID</th>
                    <th className="px-3 py-2 border-b text-left">Purchase From</th>
                    <th className="px-3 py-2 border-b text-left">Invoice No</th>
                    <th className="px-3 py-2 border-b text-left">Purchase Date</th>
                    <th className="px-3 py-2 border-b text-right">Amount</th>
                    <th className="px-3 py-2 border-b text-center">Vehicles</th>
                    <th className="px-3 py-2 border-b text-center">Inserted</th>
                    <th className="px-3 py-2 border-b text-center">Skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? (
                    rows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2 border-b">{r.id}</td>
                        <td className="px-3 py-2 border-b">{r.purchase_from || "-"}</td>
                        <td className="px-3 py-2 border-b">{r.invoice_number || "-"}</td>
                        <td className="px-3 py-2 border-b">{r.purchase_date || "-"}</td>
                        <td className="px-3 py-2 border-b text-right">
                          {r.purchase_amount != null ? Number(r.purchase_amount).toFixed(2) : "-"}
                        </td>
                        <td className="px-3 py-2 border-b text-center">{r.total_items ?? 0}</td>
                        <td className="px-3 py-2 border-b text-center text-green-700 font-medium">
                          {r.inserted_items ?? 0}
                        </td>
                        <td className="px-3 py-2 border-b text-center text-amber-700 font-medium">
                          {r.skipped_items ?? 0}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-3 py-4 text-gray-500">
                        {loading ? "Loading..." : "No purchases found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer signatures */}
            <div className="mt-10 flex justify-between text-sm">
              <div>
                <div className="font-semibold">Prepared By</div>
                <div className="mt-10">____________________</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">Authorized Sign</div>
                <div className="mt-10">____________________</div>
              </div>
            </div>
          </>
        )}
      </div>
    </AuthGuard>
  );
}