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

  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [cancelFilter, setCancelFilter] = useState<"" | "0" | "1">("");

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
        <div className="w-full mx-auto">
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

       <div className="mt-4 border border-slate-300 rounded-xl bg-white overflow-hidden shadow-sm">
  <div className="max-h-[72vh] overflow-auto">
    <table className="w-full table-fixed border-separate border-spacing-0 text-[13px] leading-tight">
      <colgroup>
        <col className="w-[60px]" />
        <col className="w-[14%]" />
        <col className="w-[10%]" />
        <col className="w-[11%]" />
        <col className="w-[16%]" />
        <col className="w-[14%]" />
        <col className="w-[14%]" />
        <col className="w-[9%]" />
        <col className="w-[8%]" />
        <col className="w-[8%]" />
      </colgroup>

      <thead className="sticky top-0 z-30">
        <tr className="bg-slate-100 text-slate-800 shadow-[inset_0_-1px_0_0_rgb(203_213_225)]">
          <th className="sticky top-0 left-0 z-40 bg-slate-100 px-3 py-2.5 text-left font-semibold border-b border-r border-slate-300">
            ID
          </th>
          <th className="sticky top-0 z-30 bg-slate-100 px-3 py-2.5 text-left font-semibold border-b border-slate-300">
            Customer
          </th>
          <th className="sticky top-0 z-30 bg-slate-100 px-3 py-2.5 text-left font-semibold border-b border-slate-300">
            Mobile
          </th>
          <th className="sticky top-0 z-30 bg-slate-100 px-3 py-2.5 text-left font-semibold border-b border-slate-300">
            Branch
          </th>
          <th className="sticky top-0 z-30 bg-slate-100 px-3 py-2.5 text-left font-semibold border-b border-slate-300">
            Vehicle
          </th>
          <th className="sticky top-0 z-30 bg-slate-100 px-3 py-2.5 text-left font-semibold border-b border-slate-300">
            Chassis
          </th>
          <th className="sticky top-0 z-30 bg-slate-100 px-3 py-2.5 text-left font-semibold border-b border-slate-300">
            Engine
          </th>
          <th className="sticky top-0 z-30 bg-slate-100 px-3 py-2.5 text-left font-semibold border-b border-slate-300">
            Sale Date
          </th>
          <th className="sticky top-0 z-30 bg-slate-100 px-3 py-2.5 text-right font-semibold border-b border-slate-300">
            Amount
          </th>
          <th className="sticky top-0 z-30 bg-slate-100 px-3 py-2.5 text-right font-semibold border-b border-slate-300">
            View
          </th>
        </tr>
      </thead>

      <tbody className="bg-white text-slate-900">
        {loading && (
          <tr>
            <td
              colSpan={10}
              className="px-3 py-4 text-center text-sm text-slate-500"
            >
              Loading...
            </td>
          </tr>
        )}

        {!loading && filtered.length === 0 && (
          <tr>
            <td
              colSpan={10}
              className="px-3 py-4 text-center text-sm text-slate-500"
            >
              No sales found.
            </td>
          </tr>
        )}

        {!loading &&
          filtered.map((s, idx) => {
            const isOld = Boolean(s.is_old);
            const rowKey = isOld ? `old-${s.id}` : `sale-${s.id}`;
            const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/50";

            return (
              <tr
                key={rowKey}
                className={`${rowBg} hover:bg-blue-50/60 transition-colors`}
              >
                <td className={`sticky left-0 z-20 ${rowBg} px-3 py-2.5 border-b border-r border-slate-200 text-slate-700 font-semibold align-top`}>
                  {s.id}
                </td>

                <td className="px-3 py-2.5 border-b border-slate-200 align-top">
                  <div className="truncate font-medium" title={s.customer_name || "-"}>
                    {s.customer_name || "-"}
                  </div>

                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {isOld && (
                      <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        Imported
                      </span>
                    )}

                    {Number(s.is_cancelled) === 1 && !isOld && (
                      <span className="inline-flex items-center rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                        Cancelled
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-3 py-2.5 border-b border-slate-200 align-top">
                  <div className="truncate" title={s.mobile_number || "-"}>
                    {s.mobile_number || "-"}
                  </div>
                </td>

                <td className="px-3 py-2.5 border-b border-slate-200 align-top">
                  <div className="truncate" title={s.branch_name || "-"}>
                    {s.branch_name || "-"}
                  </div>
                </td>

                <td className="px-3 py-2.5 border-b border-slate-200 align-top">
                  <div
                    className="truncate"
                    title={[s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || "-"}
                  >
                    {[s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || "-"}
                  </div>
                </td>

                <td className="px-3 py-2.5 border-b border-slate-200 align-top font-mono text-[12px]">
                  <div className="truncate" title={s.chassis_number || "-"}>
                    {s.chassis_number || "-"}
                  </div>
                </td>

                <td className="px-3 py-2.5 border-b border-slate-200 align-top font-mono text-[12px]">
                  <div className="truncate" title={s.engine_number || "-"}>
                    {s.engine_number || "-"}
                  </div>
                </td>

                <td className="px-3 py-2.5 border-b border-slate-200 align-top whitespace-nowrap">
                  {formatDateIN(s.sale_date)}
                </td>

                <td className="px-3 py-2.5 border-b border-slate-200 align-top text-right font-semibold whitespace-nowrap">
                  {moneyINR(s.sale_price)}
                </td>

                <td className="px-3 py-2.5 border-b border-slate-200 align-top text-right whitespace-nowrap">
                  {isOld ? (
                    <button
                      type="button"
                      onClick={() => setViewOld(s)}
                      className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      View
                    </button>
                  ) : (
                    <Link
                      href={`/sales/${s.id}`}
                      className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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