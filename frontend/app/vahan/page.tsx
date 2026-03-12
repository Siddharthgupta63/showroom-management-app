"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { getUser } from "@/lib/auth";

const TABS = [
  { key: "all", label: "All" },
  { key: "pending_fill", label: "Pending Fill" },
  { key: "pending_payment", label: "Pending Payment" },
  { key: "paid", label: "Paid" },
  { key: "unpaid", label: "Unpaid" },
  { key: "completed", label: "Completed" },
];

function formatStatus(status: string | null | undefined) {
  switch (String(status || "").toLowerCase()) {
    case "pending_insurance":
      return "Pending Insurance";
    case "ready_for_vahan":
      return "Pending Fill";
    case "payment_pending":
      return "Pending Payment";
    case "payment_done":
      return "Paid";
    case "completed":
      return "Completed";
    default:
      return "-";
  }
}

function parseDateOnly(value: any) {
  if (!value) return null;
  const s = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDate(value: any) {
  if (!value) return "-";
  const d = parseDateOnly(value);
  if (!d) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function VahanPageInner() {
  const params = useSearchParams();
  const { hasPermission, loading: permissionsLoading } = usePermissions();

  const user = getUser();
  const role = String(user?.role || "").toLowerCase();
  const isOwnerAdmin = role === "owner" || role === "admin";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState(params.get("tab") || "all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(params.get("from_date") || "");
  const [toDate, setToDate] = useState(params.get("to_date") || "");
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<any>({});

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const canVahanExport = isOwnerAdmin || hasPermission("vahan_export");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const queryParams = {
        tab,
        search,
        page,
        limit,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      };

      const [listRes, summaryRes] = await Promise.all([
        api.get("/api/vahan", { params: queryParams }),
        api.get("/api/vahan/dashboard-summary", { params: queryParams }),
      ]);

      setRows(listRes.data?.data || []);
      setPagination(
        listRes.data?.pagination || {
          page: 1,
          limit,
          total: 0,
          totalPages: 1,
        }
      );
      setSummary(summaryRes.data || {});
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load Vahan records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, limit]);

  const titleCounts = useMemo(
    () => ({
      pending_fill: summary?.pending_fill ?? 0,
      pending_payment: summary?.pending_payment ?? 0,
      paid: summary?.paid ?? 0,
      unpaid: summary?.unpaid ?? 0,
      completed: summary?.completed ?? 0,
    }),
    [summary]
  );

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    await loadData();
  }

  function clearFilters() {
    setSearch("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  function exportNow() {
    if (!canVahanExport) {
      alert("You do not have permission to export VAHAN data");
      return;
    }

    const qs = new URLSearchParams({
      tab,
      search,
      ...(fromDate ? { from_date: fromDate } : {}),
      ...(toDate ? { to_date: toDate } : {}),
    }).toString();

    const base = api.defaults.baseURL || "";
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token") || localStorage.getItem("showroom_token")
        : "";

    fetch(`${base}/api/vahan/export?${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (r) => {
        if (!r.ok) {
          let message = "Export failed";
          try {
            const data = await r.json();
            if (data?.message) message = data.message;
          } catch {}
          throw new Error(message);
        }
        const blob = await r.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "vahan_export.xlsx";
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => alert(err?.message || "Export failed"));
  }

  return (
    <AuthGuard roles={["owner", "admin", "manager", "vahan", "sales", "rc"]}>
      <div className="min-h-screen p-6 bg-gray-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Vahan Workflow</h1>
            <p className="text-sm text-gray-600 mt-1">
              Pending Fill: {summary?.pending_fill ?? 0} | Pending Payment:{" "}
              {summary?.pending_payment ?? 0}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {permissionsLoading ? null : canVahanExport && (
              <button
                onClick={exportNow}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Export
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded shadow p-4 mb-4">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setPage(1);
                }}
                className={`px-3 py-2 rounded border ${
                  tab === t.key
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                {t.label}
                {t.key === "pending_fill" ? ` (${titleCounts.pending_fill})` : ""}
                {t.key === "pending_payment" ? ` (${titleCounts.pending_payment})` : ""}
                {t.key === "paid" ? ` (${titleCounts.paid})` : ""}
                {t.key === "unpaid" ? ` (${titleCounts.unpaid})` : ""}
                {t.key === "completed" ? ` (${titleCounts.completed})` : ""}
              </button>
            ))}
          </div>

          <form onSubmit={onSearch} className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer / mobile / invoice / chassis / app no / RTO no"
                className="flex-1 border rounded px-3 py-2"
              />

              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="border rounded px-3 py-2"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-end">
              <div className="flex flex-col">
                <label className="text-sm text-gray-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border rounded px-3 py-2"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm text-gray-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border rounded px-3 py-2"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Search
              </button>

              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 border rounded"
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {loading && <p>Loading Vahan data...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && rows.length === 0 && (
          <div className="bg-white rounded shadow p-6 text-gray-600">
            No Vahan records found.
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="overflow-auto bg-white rounded shadow">
            <table className="w-full text-sm">
              <thead className="bg-gray-200 text-left">
                <tr>
                  <th className="p-2">Sale ID</th>
                  <th className="p-2">Sale Date</th>
                  <th className="p-2">Customer</th>
                  <th className="p-2">Mobile</th>
                  <th className="p-2">Vehicle</th>
                  <th className="p-2">Application No</th>
                  <th className="p-2">Fill Date</th>
                  <th className="p-2">Payment</th>
                  <th className="p-2">Payment Date</th>
                  <th className="p-2">RTO Number</th>
                  <th className="p-2">Penalty</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.sale_id} className="border-t">
                    <td className="p-2">{r.sale_id}</td>
                    <td className="p-2 whitespace-nowrap">{formatDate(r.sale_date)}</td>
                    <td className="p-2">{r.customer_name || "-"}</td>
                    <td className="p-2">{r.mobile_number || "-"}</td>
                    <td className="p-2">
                      {[r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ") || "-"}
                    </td>
                    <td className="p-2">{r.application_number || "-"}</td>
                    <td className="p-2 whitespace-nowrap">{formatDate(r.vahan_fill_date)}</td>
                    <td className="p-2">{Number(r.payment_done) ? "Paid" : "Unpaid"}</td>
                    <td className="p-2 whitespace-nowrap">{formatDate(r.vahan_payment_date)}</td>
                    <td className="p-2">{r.rto_number || "-"}</td>
                    <td className="p-2">
                      {Number(r.penalty_due)
                        ? `Yes${r.penalty_amount ? ` (${r.penalty_amount})` : ""}`
                        : "No"}
                    </td>
                    <td className="p-2">{formatStatus(r.current_status)}</td>
                    <td className="p-2">
                      <Link
                        href={`/vahan/${r.sale_id}`}
                        className="px-3 py-1 bg-blue-600 text-white rounded inline-block"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages} | Total {pagination.total}
              </div>

              <div className="flex gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-2 border rounded disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-2 border rounded disabled:opacity-50"
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

export default function VahanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-6 bg-gray-100">Loading...</div>}>
      <VahanPageInner />
    </Suspense>
  );
}