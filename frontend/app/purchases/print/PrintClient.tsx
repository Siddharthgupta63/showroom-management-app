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
    isOwnerAdmin ||
    hasPermission("view_purchases") ||
    hasPermission("manage_purchases");

  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState(sp?.get("q") || "");
  const [from, setFrom] = useState(sp?.get("from") || "");
  const [to, setTo] = useState(sp?.get("to") || "");
  const [purchaseFrom, setPurchaseFrom] = useState(
    sp?.get("purchase_from") || ""
  );

  const [purchaseFromOptions, setPurchaseFromOptions] = useState<DDItem[]>([]);

  const totals = useMemo(() => {
    const totalPurchases = rows.length;
    const totalAmount = rows.reduce(
      (s, r) => s + (Number(r.purchase_amount || 0) || 0),
      0
    );
    const totalVehicles = rows.reduce(
      (s, r) => s + (Number(r.total_items || 0) || 0),
      0
    );
    const inserted = rows.reduce(
      (s, r) => s + (Number(r.inserted_items || 0) || 0),
      0
    );
    const skipped = rows.reduce(
      (s, r) => s + (Number(r.skipped_items || 0) || 0),
      0
    );

    return { totalPurchases, totalAmount, totalVehicles, inserted, skipped };
  }, [rows]);

  const loadPurchaseFromOptions = async () => {
    try {
      const res = await api.get("/api/dropdowns", {
        params: { types: "vehicle_purchase_from" },
      });

      const data = res.data?.data || {};

      const opts: DDItem[] = (data.vehicle_purchase_from || [])
        .map((x: any) => ({
          id: Number(x.id),
          value: String(x.value ?? x.label ?? x.name ?? ""),
        }))
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

      if (autoPrint) {
        setTimeout(() => window.print(), 300);
      }
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
        <div className="text-2xl font-bold">
          Vehicle Purchases Summary
        </div>

        <div className="text-sm text-gray-600 mt-1">
          Filter: {filterLabel}
        </div>

        <div className="mt-2 text-sm text-gray-600">
          Totals — Purchases: <b>{totals.totalPurchases}</b>, Amount:{" "}
          <b>{totals.totalAmount.toFixed(2)}</b>, Vehicles:{" "}
          <b>{totals.totalVehicles}</b>, Inserted: <b>{totals.inserted}</b>,
          Skipped: <b>{totals.skipped}</b>
        </div>

        {err && (
          <div className="text-sm text-red-600 mt-2">
            {err}
          </div>
        )}

        <div className="border rounded-xl overflow-x-auto mt-4">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 border-b text-left">ID</th>
                <th className="px-3 py-2 border-b text-left">Purchase From</th>
                <th className="px-3 py-2 border-b text-left">Invoice No</th>
                <th className="px-3 py-2 border-b text-left">Purchase Date</th>
                <th className="px-3 py-2 border-b text-right">Amount</th>
              </tr>
            </thead>

            <tbody>
              {rows.length ? (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 border-b">{r.id}</td>
                    <td className="px-3 py-2 border-b">
                      {r.purchase_from || "-"}
                    </td>
                    <td className="px-3 py-2 border-b">
                      {r.invoice_number || "-"}
                    </td>
                    <td className="px-3 py-2 border-b">
                      {r.purchase_date || "-"}
                    </td>
                    <td className="px-3 py-2 border-b text-right">
                      {r.purchase_amount != null
                        ? Number(r.purchase_amount).toFixed(2)
                        : "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-gray-500">
                    {loading ? "Loading..." : "No purchases found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AuthGuard>
  );
}
