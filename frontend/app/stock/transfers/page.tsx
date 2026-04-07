"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";

type BranchRow = {
  id: number;
  branch_name: string;
};

type ChallanRow = {
  id: number;
  challan_number: string;
  challan_date: string;
  from_branch_id: number;
  to_branch_id: number;
  from_branch_name?: string | null;
  to_branch_name?: string | null;
  transporter_name?: string | null;
  vehicle_number?: string | null;
  driver_name?: string | null;
  driver_mobile?: string | null;
  lr_number?: string | null;
  total_vehicles?: number | null;
  subtotal_amount?: number | null;
  freight_amount?: number | null;
  loading_amount?: number | null;
  unloading_amount?: number | null;
  other_cost_amount?: number | null;
  discount_amount?: number | null;
  tax_amount?: number | null;
  grand_total_amount?: number | null;
  status?: string | null;
  created_by_name?: string | null;
  posted_by_name?: string | null;
  cancelled_by_name?: string | null;
  notes?: string | null;
  remarks?: string | null;
};

function money(v: any) {
  const n = Number(v || 0);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusBadge(status?: string | null) {
  const s = String(status || "").toLowerCase();
  if (s === "posted") {
    return <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">POSTED</span>;
  }
  if (s === "cancelled") {
    return <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">CANCELLED</span>;
  }
  return <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700">DRAFT</span>;
}

function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) {
    alert("No data to export");
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function StockTransferChallanListPage() {
  const [rows, setRows] = useState<ChallanRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingItems, setExportingItems] = useState(false);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function loadBranches() {
    try {
      const res = await api.get("/api/branches");
      setBranches(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setBranches([]);
    }
  }

  async function loadRows() {
    try {
      setLoading(true);
      const params: Record<string, any> = {};

      if (q.trim()) params.q = q.trim();
      if (status !== "all") params.status = status;
      if (fromBranchId) params.from_branch_id = Number(fromBranchId);
      if (toBranchId) params.to_branch_id = Number(toBranchId);
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await api.get("/api/stock-transfer-challans", { params });
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e: any) {
      console.error("loadRows error:", e);
      alert(e?.response?.data?.message || "Failed to load challans");
    } finally {
      setLoading(false);
    }
  }

  function exportChallanSummary() {
    downloadCsv(
      "stock_transfer_challans.csv",
      rows.map((r) => ({
        challan_number: r.challan_number,
        challan_date: r.challan_date,
        from_branch: r.from_branch_name || "",
        to_branch: r.to_branch_name || "",
        transporter_name: r.transporter_name || "",
        vehicle_number: r.vehicle_number || "",
        driver_name: r.driver_name || "",
        driver_mobile: r.driver_mobile || "",
        lr_number: r.lr_number || "",
        total_vehicles: r.total_vehicles || 0,
        subtotal_amount: r.subtotal_amount || 0,
        freight_amount: r.freight_amount || 0,
        loading_amount: r.loading_amount || 0,
        unloading_amount: r.unloading_amount || 0,
        other_cost_amount: r.other_cost_amount || 0,
        discount_amount: r.discount_amount || 0,
        tax_amount: r.tax_amount || 0,
        grand_total_amount: r.grand_total_amount || 0,
        status: r.status || "",
        notes: r.notes || "",
        remarks: r.remarks || "",
      }))
    );
  }

  async function exportAllVehicleRows() {
    try {
      setExportingItems(true);

      const params: Record<string, any> = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (fromBranchId) params.from_branch_id = Number(fromBranchId);
      if (toBranchId) params.to_branch_id = Number(toBranchId);
      if (status !== "all") params.status = status;

      const res = await api.get("/api/stock-transfer-challans/export-items", { params });
      const exportRows = Array.isArray(res.data?.data) ? res.data.data : [];

      downloadCsv(
        "stock_transfer_all_vehicle_rows.csv",
        exportRows.map((r: any) => ({
          challan_number: r.challan_number || "",
          challan_date: r.challan_date || "",
          status: r.status || "",
          from_branch: r.from_branch_name || "",
          to_branch: r.to_branch_name || "",
          transporter_name: r.transporter_name || "",
          vehicle_number: r.vehicle_number || "",
          driver_name: r.driver_name || "",
          driver_mobile: r.driver_mobile || "",
          lr_number: r.lr_number || "",
          stock_item_id: r.stock_item_id || "",
          model_name: r.model_name || "",
          variant_name: r.variant_name || "",
          color: r.color || "",
          chassis_number: r.chassis_number || "",
          engine_number: r.engine_number || "",
          unit_amount: r.unit_amount || 0,
          line_amount: r.line_amount || 0,
          notes: r.notes || "",
          remarks: r.remarks || "",
        }))
      );
    } catch (e: any) {
      console.error("exportAllVehicleRows error:", e);
      alert(e?.response?.data?.message || "Failed to export vehicle rows");
    } finally {
      setExportingItems(false);
    }
  }

  async function postChallan(id: number) {
    if (!window.confirm("Post this challan? This will move stock to destination branch.")) return;
    try {
      await api.post(`/api/stock-transfer-challans/${id}/post`);
      await loadRows();
      alert("Challan posted successfully");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to post challan");
    }
  }

  async function cancelChallan(id: number) {
    const reason = window.prompt("Cancel reason (optional)") || "";
    try {
      await api.post(`/api/stock-transfer-challans/${id}/cancel`, {
        cancel_reason: reason || null,
      });
      await loadRows();
      alert("Challan cancelled successfully");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to cancel challan");
    }
  }

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, fromBranchId, toBranchId, dateFrom, dateTo]);

  return (
    <AuthGuard>
      <div className="p-6 space-y-6">
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Stock Transfer Challans</h1>
              <p className="text-sm text-gray-500">
                Multi-vehicle branch transfer challans with print and posting
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Link
                href="/stock"
                className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
              >
                ← Back to Stock
              </Link>

              <button
                onClick={exportChallanSummary}
                className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
              >
                Export Challans
              </button>

              <button
                onClick={exportAllVehicleRows}
                disabled={exportingItems}
                className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {exportingItems ? "Exporting..." : "Export All Vehicles"}
              </button>

              <Link
                href="/stock/transfers/new"
                className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black"
              >
                + New Challan
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow space-y-4">
          <h2 className="text-lg font-semibold">Filters</h2>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Challan no / transporter / vehicle / LR"
              className="px-3 py-2 border rounded-lg md:col-span-2"
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="posted">Posted</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={fromBranchId}
              onChange={(e) => setFromBranchId(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All From Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.branch_name}
                </option>
              ))}
            </select>

            <select
              value={toBranchId}
              onChange={(e) => setToBranchId(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All To Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.branch_name}
                </option>
              ))}
            </select>

            <button
              onClick={loadRows}
              className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
            >
              Search
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            />

            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            />

            <button
              onClick={() => {
                setQ("");
                setStatus("all");
                setFromBranchId("");
                setToBranchId("");
                setDateFrom("");
                setDateTo("");
              }}
              className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold mb-4">Transfer Challans</h2>

          {loading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-gray-500">No challans found</div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 border-b text-left">Challan</th>
                    <th className="p-3 border-b text-left">Date</th>
                    <th className="p-3 border-b text-left">From</th>
                    <th className="p-3 border-b text-left">To</th>
                    <th className="p-3 border-b text-left">Transport</th>
                    <th className="p-3 border-b text-left">Vehicles</th>
                    <th className="p-3 border-b text-left">Grand Total</th>
                    <th className="p-3 border-b text-left">Status</th>
                    <th className="p-3 border-b text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isDraft = String(r.status || "").toLowerCase() === "draft";

                    return (
                      <tr key={r.id} className="border-t">
                        <td className="p-3">
                          <div className="font-semibold">{r.challan_number}</div>
                          <div className="text-xs text-gray-500">#{r.id}</div>
                        </td>
                        <td className="p-3">{r.challan_date || "-"}</td>
                        <td className="p-3">{r.from_branch_name || "-"}</td>
                        <td className="p-3">{r.to_branch_name || "-"}</td>
                        <td className="p-3">
                          <div>{r.transporter_name || "-"}</div>
                          <div className="text-xs text-gray-500">{r.vehicle_number || "-"}</div>
                        </td>
                        <td className="p-3">{r.total_vehicles || 0}</td>
                        <td className="p-3">₹ {money(r.grand_total_amount || 0)}</td>
                        <td className="p-3">{statusBadge(r.status)}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/stock/transfers/${r.id}`}
                              className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                            >
                              View
                            </Link>

                            {isDraft && (
                              <Link
                                href={`/stock/transfers/${r.id}?mode=edit`}
                                className="px-3 py-1.5 rounded border bg-blue-600 text-white hover:bg-blue-700"
                              >
                                Edit
                              </Link>
                            )}

                            <Link
                              href={`/stock/transfers/${r.id}?print=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                            >
                              Print
                            </Link>

                            {isDraft && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => postChallan(r.id)}
                                  className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                                >
                                  Post
                                </button>

                                <button
                                  type="button"
                                  onClick={() => cancelChallan(r.id)}
                                  className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}