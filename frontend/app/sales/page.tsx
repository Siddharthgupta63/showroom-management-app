"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { getUser } from "@/lib/auth";

type SaleRow = {
  id: number;
  customer_name: string;
  mobile_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  chassis_number: string | null;
  engine_number: string | null;
  sale_date: string | null;
  sale_price: number | null;
  invoice_number?: string | null;
  is_cancelled?: number | null;

  branch_id?: number | null;
  branch_name?: string | null;

  is_old?: number | boolean | null;
  notes?: string | null;
};

type SalesListResp = {
  success: boolean;
  data: SaleRow[];
  page?: number;
  pageSize?: number;
  total?: number;
};

type BranchRow = {
  id: number;
  branch_name: string;
  address?: string | null;
  is_active?: number | null;
};

type BranchListResp = {
  success: boolean;
  data: BranchRow[];
};

function formatDateIN(d?: string | null) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function moneyINR(n: any) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "₹0";
  return `₹${v.toLocaleString("en-IN")}`;
}

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function SalesRegisterPage() {
  const { hasPermission, loading: permsLoading } = usePermissions();
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    const u = getUser();
    setRole(String(u?.role || "").toLowerCase());
  }, []);

  const isOwnerAdmin = role === "owner" || role === "admin";
  const isManager = role === "manager";
  const isSalesRole = role === "sales";

  const canCreate =
    isOwnerAdmin ||
    isManager ||
    isSalesRole ||
    hasPermission("sales_create") ||
    hasPermission("pipeline_open_sale");

  const canUploadOld =
    isOwnerAdmin || hasPermission("bulk_upload") || hasPermission("import_excel");

  const canEdit = isOwnerAdmin || isManager || hasPermission("sales_edit");

  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 300);

  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const [viewOld, setViewOld] = useState<SaleRow | null>(null);

  // Filters
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [cancelFilter, setCancelFilter] = useState<"" | "0" | "1">("");

  // ✅ Date range filters (value returned is YYYY-MM-DD)
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const totalPages = useMemo(() => {
    const t = Number(total || 0);
    return Math.max(1, Math.ceil(t / pageSize));
  }, [total, pageSize]);

  const fetchBranches = async () => {
    try {
      const res = await api.get<BranchListResp>("/api/branches");
      setBranches(res.data?.data || []);
    } catch {
      setBranches([]);
    }
  };

  const buildParams = (opts?: {
    search?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const search = (opts?.search ?? q).trim();
    const p = opts?.page ?? page;
    const ps = opts?.pageSize ?? pageSize;

    const params: any = { page: p, pageSize: ps };

    if (search) params.q = search;
    if (branchId !== "") params.branch_id = branchId;
    if (cancelFilter !== "") params.is_cancelled = cancelFilter;

    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    return params;
  };

  const fetchList = async (opts?: { search?: string; page?: number; pageSize?: number }) => {
    setLoading(true);
    setErr(null);
    try {
      const params = buildParams(opts);
      const res = await api.get<SalesListResp>("/api/sales", { params });
      setRows(res.data?.data || []);
      setTotal(Number(res.data?.total || 0));
    } catch (e: any) {
      setRows([]);
      setTotal(0);
      setErr(e?.response?.data?.message || "Failed to load sales");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permsLoading) {
      fetchBranches();
      fetchList({ search: "", page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permsLoading]);

  useEffect(() => {
    if (permsLoading) return;
    setPage(1);
    fetchList({ search: debouncedQ, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, permsLoading]);

  // ✅ when filters change, reload
  useEffect(() => {
    if (permsLoading) return;
    setPage(1);
    fetchList({ search: debouncedQ, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, cancelFilter, dateFrom, dateTo, permsLoading]);

  const onSearchClick = async () => {
    setPage(1);
    await fetchList({ search: q, page: 1 });
  };

  const onReset = async () => {
    setQ("");
    setBranchId("");
    setCancelFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    await fetchList({ search: "", page: 1 });
  };

  const downloadTemplateCSV = () => {
    const headers = [
      "customer_name",
      "mobile_number",
      "vehicle_make",
      "vehicle_model",
      "chassis_number",
      "engine_number",
      "sale_date",
      "notes",
    ];
    const sample = [
      "Siddharth Gupta",
      "9999990000",
      "Hero",
      "Splendor Plus i3S",
      "CH123456789",
      "EN987654321",
      "2025-12-31",
      "Imported old sale",
    ];
    const csv = `${headers.join(",")}\n${sample
      .map((x) => `"${String(x).replace(/"/g, '""')}"`)
      .join(",")}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "old_sales_upload_template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const uploadOldSales = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await api.post("/api/sales/upload-old", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const msg =
        res?.data?.message ||
        (res?.data?.inserted != null
          ? `Old sales uploaded successfully ✅\n\nRows: ${res.data.rows ?? "-"} | Inserted: ${
              res.data.inserted ?? "-"
            } | Skipped: ${res.data.skipped ?? "-"}`
          : "Old sales uploaded successfully ✅");

      setPage(1);
      await fetchList({ search: debouncedQ, page: 1 });
      alert(msg);
    } catch (err2: any) {
      alert(err2?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ✅ Export (Owner/Admin) + respects filters + date range
  const exportSales = async () => {
    try {
      const params = buildParams({});
      delete params.page;
      delete params.pageSize;

      const res = await api.get("/api/sales/export", {
        params,
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales_export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err2: any) {
      alert(err2?.response?.data?.message || "Export failed (backend /api/sales/export missing)");
    }
  };

  const filtered = rows;

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Sales Register</h1>
              <p className="text-sm text-slate-600">
                Search supports name/mobile/chassis/engine/invoice. Filters support branch, status and date range.
              </p>
            </div>

            <div className="flex gap-2 items-center flex-wrap">
              {canCreate && (
                <Link
                  href="/sales/new"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  + New Sale
                </Link>
              )}

              <button
                onClick={downloadTemplateCSV}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              >
                Download CSV Template
              </button>

              {canUploadOld && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadOldSales(f);
                    }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {uploading ? "Uploading..." : "Upload Old Sales"}
                  </button>
                </>
              )}

              {isOwnerAdmin && (
                <button
                  onClick={exportSales}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                >
                  Export Sales
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 p-4 border border-slate-300 rounded-xl bg-white">
            <div className="flex gap-2 items-center flex-wrap">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name / mobile / chassis / engine / invoice..."
                className="flex-1 min-w-[260px] px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400"
              />
              <button
                onClick={onSearchClick}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
              >
                Search
              </button>
              <button
                onClick={onReset}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              >
                Reset
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">Branch</span>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
                  className="px-2 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                >
                  <option value="">All</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branch_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">Status</span>
                <select
                  value={cancelFilter}
                  onChange={(e) => setCancelFilter(e.target.value as any)}
                  className="px-2 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                >
                  <option value="">All</option>
                  <option value="0">Active</option>
                  <option value="1">Cancelled</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                />
              </div>

              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-slate-700">Page size</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const ps = Number(e.target.value);
                    setPageSize(ps);
                    setPage(1);
                    fetchList({ search: debouncedQ, page: 1, pageSize: ps });
                  }}
                  className="px-2 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

            <div className="mt-4 overflow-auto border border-slate-300 rounded-xl bg-white">
              <table className="min-w-[1100px] w-full">
                <thead className="bg-slate-50 text-sm text-slate-800">
                  <tr>
                    <th className="p-3 text-left">ID</th>
                    <th className="p-3 text-left">Customer</th>
                    <th className="p-3 text-left">Mobile</th>
                    <th className="p-3 text-left">Branch</th>
                    <th className="p-3 text-left">Vehicle</th>
                    <th className="p-3 text-left">Chassis</th>
                    <th className="p-3 text-left">Engine</th>
                    <th className="p-3 text-left">Sale Date</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-900">
                  {loading && (
                    <tr>
                      <td className="p-4 text-slate-600" colSpan={10}>
                        Loading...
                      </td>
                    </tr>
                  )}

                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td className="p-4 text-slate-600" colSpan={10}>
                        No sales found.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filtered.map((s) => {
                      const isOld = Boolean(s.is_old);
                      const rowKey = isOld ? `old-${s.id}` : `sale-${s.id}`;
                      return (
                        <tr key={rowKey} className="border-t border-slate-200 hover:bg-slate-50">
                          <td className="p-3 text-slate-600">{s.id}</td>
                          <td className="p-3 font-medium text-slate-900">
                            {s.customer_name || "-"}{" "}
                            {isOld && (
                              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                                Imported
                              </span>
                            )}
                            {Number(s.is_cancelled) === 1 && !isOld && (
                              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                                Cancelled
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-slate-900">{s.mobile_number || "-"}</td>
                          <td className="p-3 text-slate-900">{s.branch_name || "-"}</td>
                          <td className="p-3 text-slate-900">
                            {[s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || "-"}
                          </td>
                          <td className="p-3 font-mono text-slate-900">{s.chassis_number || "-"}</td>
                          <td className="p-3 font-mono text-slate-900">{s.engine_number || "-"}</td>
                          <td className="p-3 text-slate-900">{formatDateIN(s.sale_date)}</td>
                          <td className="p-3 text-right font-semibold text-slate-900">
                            {moneyINR(s.sale_price)}
                          </td>
                          <td className="p-3 text-right">
                            {isOld ? (
                              <button
                                type="button"
                                onClick={() => setViewOld(s)}
                                className="inline-block px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 hover:bg-slate-50 text-sm"
                              >
                                View
                              </button>
                            ) : (
                              <Link
                                href={`/sales/${s.id}`}
                                className="inline-block px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 hover:bg-slate-50 text-sm"
                              >
                                {canEdit ? "Edit / View" : "View"}
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-slate-700">
                Total: <b>{total}</b> | Page <b>{page}</b> of <b>{totalPages}</b>
              </div>

              <div className="flex gap-2">
                <button
                  className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  disabled={page <= 1 || loading}
                  onClick={() => {
                    const p = Math.max(1, page - 1);
                    setPage(p);
                    fetchList({ search: debouncedQ, page: p });
                  }}
                >
                  Prev
                </button>
                <button
                  className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  disabled={page >= totalPages || loading}
                  onClick={() => {
                    const p = Math.min(totalPages, page + 1);
                    setPage(p);
                    fetchList({ search: debouncedQ, page: p });
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewOld && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-xl shadow-lg border border-slate-300">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-slate-900">Imported Sale (Read-only)</div>
                  <div className="text-xs text-slate-600">This is an imported old sale record.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewOld(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 hover:bg-slate-50 text-sm"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-4 text-sm space-y-2 text-slate-900">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-600">Customer</div>
                  <div className="font-medium">{viewOld.customer_name || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-600">Mobile</div>
                  <div className="font-medium">{viewOld.mobile_number || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-600">Branch</div>
                  <div className="font-medium">{viewOld.branch_name || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-600">Sale Date</div>
                  <div className="font-medium">{formatDateIN(viewOld.sale_date)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-600">Vehicle</div>
                  <div className="font-medium">
                    {[viewOld.vehicle_make, viewOld.vehicle_model].filter(Boolean).join(" ") || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-600">Amount</div>
                  <div className="font-semibold">{moneyINR(viewOld.sale_price)}</div>
                </div>
              </div>

              {viewOld.notes ? (
                <div className="pt-2">
                  <div className="text-xs text-slate-600">Notes</div>
                  <div className="whitespace-pre-wrap">{viewOld.notes}</div>
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewOld(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}