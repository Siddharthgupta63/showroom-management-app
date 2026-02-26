"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";

type PurchaseRow = {
  id: number;
  purchase_from: string | null;
  invoice_number: string | null;
  purchase_date: string | null; // YYYY-MM-DD
  purchase_amount: number | null;

  total_items: number;
  inserted_items: number;
  skipped_items: number;

  created_at: string | null;
};

export default function PurchasesListPage() {
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

  const [q, setQ] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const load = async (opts?: { page?: number }) => {
    setLoading(true);
    setErr("");
    try {
      const p = opts?.page ?? page;
      const res = await api.get("/api/purchases", {
        params: { q: q.trim() || undefined, page: p, pageSize },
      });
      setRows(res.data?.data || []);
      setTotal(Number(res.data?.total || 0));
      setPage(Number(res.data?.page || p));
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to load purchases");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    if (permsLoading) return;
    if (!canView) return;
    load({ page: 1 });
    // eslint-disable-next-line
  }, [mounted, pageSize, permsLoading, canView]);

  if (!mounted) return null;

  return (
    <AuthGuard>
      <div className="p-6">
        {!permsLoading && !canView ? (
          <div className="bg-white p-6 rounded-xl shadow">
            <h1 className="text-xl font-bold">Vehicle Purchases</h1>
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
                <h1 className="text-2xl font-bold">Vehicle Purchases</h1>
                <p className="text-sm text-gray-500">
                  Track supplier invoice-wise purchases and created vehicles.
                </p>
              </div>

              <div className="flex gap-2">
                {canManage && (
                  <Link
                    href="/purchases/new"
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    + New Purchase
                  </Link>
                )}

                <Link
                  href="/purchases/print"
                  className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50"
                >
                  Print Summary
                </Link>

                {canManage && (
                  <button
                    onClick={() => {
                      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
                      window.location.href = `/api/purchases/_export${qs}`;
                    }}
                    className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50"
                  >
                    Export
                  </button>
                )}

                <Link href="/vehicles" className="px-4 py-2 border rounded-lg">
                  Vehicles
                </Link>
              </div>
            </div>

            <div className="mt-5 flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <label className="text-sm font-medium">Search</label>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by supplier / invoice no / purchase id"
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Page size</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                >
                  {[10, 20, 50, 100].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => load({ page: 1 })}
                className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50"
                disabled={loading}
              >
                Search
              </button>

              <button
                onClick={() => {
                  setQ("");
                  setPage(1);
                  setTimeout(() => load({ page: 1 }), 0);
                }}
                className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50"
                disabled={loading}
              >
                Reset
              </button>
            </div>

            {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}

            <div className="mt-4 overflow-x-auto border rounded-xl">
              <table className="min-w-full text-sm bg-white">
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
                    <th className="px-3 py-2 border-b text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? (
                    rows.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
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
                        <td className="px-3 py-2 border-b text-right">
                          <Link
                            href={`/purchases/${r.id}`}
                            className="px-3 py-1.5 border rounded-lg bg-white hover:bg-gray-50"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-3 py-4 text-gray-500">
                        {loading ? "Loading..." : "No purchases found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-gray-600">
                Total: <span className="font-medium">{total}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 border rounded-lg disabled:opacity-50"
                  disabled={loading || page <= 1}
                  onClick={() => load({ page: page - 1 })}
                >
                  Prev
                </button>
                <div className="text-sm">
                  Page <b>{page}</b> / {totalPages}
                </div>
                <button
                  className="px-3 py-1.5 border rounded-lg disabled:opacity-50"
                  disabled={loading || page >= totalPages}
                  onClick={() => load({ page: page + 1 })}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}