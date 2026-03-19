"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

type StockRow = {
  id: number;
  purchase_id: number;
  chassis_number: string;
  engine_number: string;
  model_id?: number | null;
  variant_id?: number | null;
  color?: string | null;
  purchase_price?: number | null;
  status_code: string;
  booked_at?: string | null;
  sold_at?: string | null;
  delivered_at?: string | null;
  sale_id?: number | null;

  purchase_from?: string | null;
  entry_type?: string | null;
  document_number?: string | null;
  document_date?: string | null;
  invoice_pending?: number | null;
  supplier_name?: string | null;
  received_date?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  purchase_date?: string | null;

  model_name?: string | null;
  variant_name?: string | null;
  branch_name?: string | null;
};

type DropdownRow = {
  id: number;
  value: string;
  label?: string | null;
  type?: string;
  is_active?: number;
};

type SummaryColorRow = {
  key: string;
  model_name: string;
  variant_name: string;
  color_code: string;
  color_label: string;
  display_color: string;
  total_qty: number;
  in_stock_qty: number;
  sold_qty: number;
  delivered_qty: number;
  other_qty: number;
};

type SummaryVariantRow = {
  key: string;
  model_name: string;
  variant_name: string;
  total_qty: number;
  in_stock_qty: number;
  sold_qty: number;
  delivered_qty: number;
  other_qty: number;
};

function Badge({ status }: { status: string }) {
  const s = String(status || "").toLowerCase();

  let cls = "inline-flex rounded-full px-2 py-1 text-xs font-semibold border ";

  if (s === "in_stock") cls += "bg-green-50 text-green-700 border-green-200";
  else if (s === "sold") cls += "bg-blue-50 text-blue-700 border-blue-200";
  else if (s === "delivered") cls += "bg-purple-50 text-purple-700 border-purple-200";
  else if (s === "booked") cls += "bg-yellow-50 text-yellow-700 border-yellow-200";
  else if (s === "unlinked") cls += "bg-orange-50 text-orange-700 border-orange-200";
  else if (s === "duplicate") cls += "bg-red-50 text-red-700 border-red-200";
  else cls += "bg-gray-50 text-gray-700 border-gray-200";

  return <span className={cls}>{status || "-"}</span>;
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

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

const COLOR_LABEL_FALLBACK: Record<string, string> = {
  BKB: "NEXA BLUE",
  BKG: "BLACK SILVER",
  BHG: "BLACK SILVER",
  BKR: "BLACK RED",
  BLA: "ALL BLACK",
  BLK: "BLACK",
  BRB: "GOLDEN",
  BRD: "ALL RED",
  BRE: "BLACK RED",
  BGY: "BLACK SILVER",
  SBK: "BLACK RED",
};

export default function StockPage() {
  const [user, setUser] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [uploading, setUploading] = useState(false);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("in_stock");
  const [modelFilter, setModelFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [colorRows, setColorRows] = useState<DropdownRow[]>([]);
  const [otherPreviewTitle, setOtherPreviewTitle] = useState("");
  const [otherPreviewRows, setOtherPreviewRows] = useState<StockRow[]>([]);

  const role = String(user?.role || "").toLowerCase();
  const isOwnerAdmin = role === "owner" || role === "admin";
  const isOwnerAdminManager =
    role === "owner" || role === "admin" || role === "manager";

  useEffect(() => {
    setUser(getUser());
    fetchStock();
    fetchColorDropdowns();
  }, []);

  async function fetchStock() {
    try {
      setLoading(true);
      const res = await api.get("/api/stock");
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e: any) {
      console.error("fetchStock failed", e?.response?.status, e?.response?.data || e);
      alert(`Stock API failed: ${e?.response?.data?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchColorDropdowns() {
    try {
      const res = await api.get("/api/dropdowns", {
        params: { types: "vehicle_color" },
      });

      const payload = res?.data?.data;
      const list = Array.isArray(payload?.vehicle_color) ? payload.vehicle_color : [];

      setColorRows(list);
    } catch (e) {
      console.warn("color dropdown fetch skipped", e);
      setColorRows([]);
    }
  }

  const colorMap = useMemo(() => {
    const m = new Map<string, string>();
    const list = Array.isArray(colorRows) ? colorRows : [];

    for (const r of list) {
      const code = String(r?.value || "").trim().toUpperCase();
      const label = String(r?.label || "").trim();
      if (code && label) m.set(code, label.toUpperCase());
    }

    for (const [code, label] of Object.entries(COLOR_LABEL_FALLBACK)) {
      if (!m.has(code)) m.set(code, label);
    }

    return m;
  }, [colorRows]);

  function colorDisplay(codeRaw?: string | null) {
    const code = String(codeRaw || "").trim().toUpperCase();
    if (!code || code === "-") return "-";
    const label = colorMap.get(code);
    return label ? `${code} — ${label}` : code;
  }

  function getStockDate(r: StockRow) {
    return (
      String(r.purchase_date || "").trim() ||
      String(r.document_date || "").trim() ||
      String(r.invoice_date || "").trim() ||
      ""
    );
  }

  function matchesDateRange(r: StockRow) {
    const d = getStockDate(r);
    if (!dateFrom && !dateTo) return true;
    if (!d) return false;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }

  function isOtherStatus(status?: string | null) {
    const s = String(status || "").toLowerCase();
    return !["in_stock", "sold", "delivered"].includes(s);
  }

  async function downloadSample() {
    try {
      const res = await api.get("/api/stock/import/sample", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "vehicle_stock_import_sample.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to download sample");
    }
  }

  async function importExcel(file: File) {
    try {
      setUploading(true);

      const fd = new FormData();
      fd.append("file", file);

      const res = await api.post("/api/stock/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const summary = res.data?.summary;
      alert(
        `Import completed\nTotal: ${summary?.total || 0}\nSuccess: ${
          summary?.success_count || 0
        }\nFailed: ${summary?.failed_count || 0}`
      );

      await fetchStock();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Import failed");
    } finally {
      setUploading(false);
    }
  }

  async function markDelivered(id: number) {
    try {
      await api.patch(`/api/stock/${id}/delivered`);
      await fetchStock();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to mark delivered");
    }
  }

  const modelOptions = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((r) => String(r.model_name || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredBaseRows = useMemo(() => {
    let out = [...rows];

    if (modelFilter !== "all") {
      out = out.filter(
        (r) => String(r.model_name || "").trim().toLowerCase() === modelFilter.toLowerCase()
      );
    }

    out = out.filter(matchesDateRange);

    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter((r) =>
        [
          r.chassis_number,
          r.engine_number,
          r.model_name,
          r.variant_name,
          r.color,
          colorDisplay(r.color),
          r.status_code,
          r.purchase_from,
          r.document_number,
          r.invoice_number,
          r.branch_name,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle))
      );
    }

    return out;
  }, [rows, modelFilter, q, dateFrom, dateTo, colorMap]);

  const detailedRows = useMemo(() => {
    let out = [...filteredBaseRows];

    if (statusFilter !== "all") {
      out = out.filter(
        (r) => String(r.status_code || "").toLowerCase() === statusFilter
      );
    }

    return out;
  }, [filteredBaseRows, statusFilter]);

  const summaryRows = useMemo(() => {
    const map = new Map<string, SummaryColorRow>();

    for (const r of filteredBaseRows) {
      const model = String(r.model_name || "-").trim() || "-";
      const variant = String(r.variant_name || "-").trim() || "-";
      const colorCode = String(r.color || "-").trim().toUpperCase() || "-";
      const colorLabel = colorMap.get(colorCode) || "";
      const displayColor =
        colorCode === "-" ? "-" : colorLabel ? `${colorCode} — ${colorLabel}` : colorCode;

      const key = `${model}__${variant}__${colorCode}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          model_name: model,
          variant_name: variant,
          color_code: colorCode,
          color_label: colorLabel,
          display_color: displayColor,
          total_qty: 0,
          in_stock_qty: 0,
          sold_qty: 0,
          delivered_qty: 0,
          other_qty: 0,
        });
      }

      const row = map.get(key)!;
      row.total_qty += 1;

      const s = String(r.status_code || "").toLowerCase();
      if (s === "in_stock") row.in_stock_qty += 1;
      else if (s === "sold") row.sold_qty += 1;
      else if (s === "delivered") row.delivered_qty += 1;
      else row.other_qty += 1;
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.model_name !== b.model_name) return a.model_name.localeCompare(b.model_name);
      if (a.variant_name !== b.variant_name) return a.variant_name.localeCompare(b.variant_name);
      return a.display_color.localeCompare(b.display_color);
    });
  }, [filteredBaseRows, colorMap]);

  const variantOnlyRows = useMemo(() => {
    const map = new Map<string, SummaryVariantRow>();

    for (const r of filteredBaseRows) {
      const model = String(r.model_name || "-").trim() || "-";
      const variant = String(r.variant_name || "-").trim() || "-";
      const key = `${model}__${variant}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          model_name: model,
          variant_name: variant,
          total_qty: 0,
          in_stock_qty: 0,
          sold_qty: 0,
          delivered_qty: 0,
          other_qty: 0,
        });
      }

      const row = map.get(key)!;
      row.total_qty += 1;

      const s = String(r.status_code || "").toLowerCase();
      if (s === "in_stock") row.in_stock_qty += 1;
      else if (s === "sold") row.sold_qty += 1;
      else if (s === "delivered") row.delivered_qty += 1;
      else row.other_qty += 1;
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.model_name !== b.model_name) return a.model_name.localeCompare(b.model_name);
      return a.variant_name.localeCompare(b.variant_name);
    });
  }, [filteredBaseRows]);

  const summaryCards = useMemo(() => {
    const x = {
      total: rows.length,
      in_stock: 0,
      sold: 0,
      delivered_other: 0,
    };

    for (const r of rows) {
      const s = String(r.status_code || "").toLowerCase();
      if (s === "in_stock") x.in_stock++;
      else if (s === "sold") x.sold++;
      else x.delivered_other++;
    }

    return x;
  }, [rows]);

  const summaryTotals = useMemo(() => {
    return summaryRows.reduce(
      (acc, r) => {
        acc.total_qty += r.total_qty;
        acc.in_stock_qty += r.in_stock_qty;
        acc.sold_qty += r.sold_qty;
        acc.delivered_qty += r.delivered_qty;
        acc.other_qty += r.other_qty;
        return acc;
      },
      {
        total_qty: 0,
        in_stock_qty: 0,
        sold_qty: 0,
        delivered_qty: 0,
        other_qty: 0,
      }
    );
  }, [summaryRows]);

  const variantOnlyTotals = useMemo(() => {
    return variantOnlyRows.reduce(
      (acc, r) => {
        acc.total_qty += r.total_qty;
        acc.in_stock_qty += r.in_stock_qty;
        acc.sold_qty += r.sold_qty;
        acc.delivered_qty += r.delivered_qty;
        acc.other_qty += r.other_qty;
        return acc;
      },
      {
        total_qty: 0,
        in_stock_qty: 0,
        sold_qty: 0,
        delivered_qty: 0,
        other_qty: 0,
      }
    );
  }, [variantOnlyRows]);

  const detailedTotals = useMemo(() => {
    return {
      total_qty: detailedRows.length,
      in_stock_qty: detailedRows.filter((r) => String(r.status_code).toLowerCase() === "in_stock").length,
      sold_qty: detailedRows.filter((r) => String(r.status_code).toLowerCase() === "sold").length,
      delivered_qty: detailedRows.filter((r) => String(r.status_code).toLowerCase() === "delivered").length,
      other_qty: detailedRows.filter((r) =>
        !["in_stock", "sold", "delivered"].includes(String(r.status_code).toLowerCase())
      ).length,
    };
  }, [detailedRows]);

  function exportSummary() {
    downloadCsv(
      "stock_summary_with_color.csv",
      summaryRows.map((r) => ({
        model: r.model_name,
        variant: r.variant_name,
        color: r.display_color,
        total_qty: r.total_qty,
        in_stock_qty: r.in_stock_qty,
        sold_qty: r.sold_qty,
        delivered_qty: r.delivered_qty,
        other_qty: r.other_qty,
      }))
    );
  }

  function exportVariantOnly() {
    downloadCsv(
      "stock_summary_variant_only.csv",
      variantOnlyRows.map((r) => ({
        model: r.model_name,
        variant: r.variant_name,
        total_qty: r.total_qty,
        in_stock_qty: r.in_stock_qty,
        sold_qty: r.sold_qty,
        delivered_qty: r.delivered_qty,
        other_qty: r.other_qty,
      }))
    );
  }

  function exportDetailed() {
    downloadCsv(
      "stock_detailed.csv",
      detailedRows.map((r) => ({
        id: r.id,
        purchase_id: r.purchase_id,
        stock_date: getStockDate(r) || "-",
        chassis_number: r.chassis_number,
        engine_number: r.engine_number,
        model: r.model_name || "-",
        variant: r.variant_name || "-",
        color: colorDisplay(r.color),
        status: r.status_code || "-",
        purchase_source: r.purchase_from || "-",
        entry_type: r.entry_type || "-",
        document: r.document_number || r.invoice_number || "-",
        sale_id: r.sale_id || "",
      }))
    );
  }

  function exportRowsAsDetailed(filename: string, list: StockRow[]) {
    downloadCsv(
      filename,
      list.map((r) => ({
        id: r.id,
        purchase_id: r.purchase_id,
        stock_date: getStockDate(r) || "-",
        chassis_number: r.chassis_number,
        engine_number: r.engine_number,
        model: r.model_name || "-",
        variant: r.variant_name || "-",
        color: colorDisplay(r.color),
        status: r.status_code || "-",
        purchase_source: r.purchase_from || "-",
        entry_type: r.entry_type || "-",
        document: r.document_number || r.invoice_number || "-",
        sale_id: r.sale_id || "",
      }))
    );
  }

  function showOtherDetailsByColor(row: SummaryColorRow) {
    const list = filteredBaseRows.filter((r) => {
      const model = String(r.model_name || "-").trim() || "-";
      const variant = String(r.variant_name || "-").trim() || "-";
      const colorCode = String(r.color || "-").trim().toUpperCase() || "-";

      return (
        model === row.model_name &&
        variant === row.variant_name &&
        colorCode === row.color_code &&
        isOtherStatus(r.status_code)
      );
    });

    setOtherPreviewTitle(
      `Other Details: ${row.model_name} / ${row.variant_name} / ${row.display_color}`
    );
    setOtherPreviewRows(list);
  }

  function exportOtherDetailsByColor(row: SummaryColorRow) {
    const list = filteredBaseRows.filter((r) => {
      const model = String(r.model_name || "-").trim() || "-";
      const variant = String(r.variant_name || "-").trim() || "-";
      const colorCode = String(r.color || "-").trim().toUpperCase() || "-";

      return (
        model === row.model_name &&
        variant === row.variant_name &&
        colorCode === row.color_code &&
        isOtherStatus(r.status_code)
      );
    });

    exportRowsAsDetailed(
      `other_details_${row.model_name}_${row.variant_name}_${row.color_code}.csv`,
      list
    );
  }

  function showOtherDetailsByVariant(row: SummaryVariantRow) {
    const list = filteredBaseRows.filter((r) => {
      const model = String(r.model_name || "-").trim() || "-";
      const variant = String(r.variant_name || "-").trim() || "-";

      return (
        model === row.model_name &&
        variant === row.variant_name &&
        isOtherStatus(r.status_code)
      );
    });

    setOtherPreviewTitle(`Other Details: ${row.model_name} / ${row.variant_name}`);
    setOtherPreviewRows(list);
  }

  function exportOtherDetailsByVariant(row: SummaryVariantRow) {
    const list = filteredBaseRows.filter((r) => {
      const model = String(r.model_name || "-").trim() || "-";
      const variant = String(r.variant_name || "-").trim() || "-";

      return (
        model === row.model_name &&
        variant === row.variant_name &&
        isOtherStatus(r.status_code)
      );
    });

    exportRowsAsDetailed(
      `other_details_${row.model_name}_${row.variant_name}.csv`,
      list
    );
  }

  return (
    <AuthGuard>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Vehicle Stock</h1>
          <p className="text-sm text-gray-500">
            Purchases create stock, sales consume stock. Use this page for stock tracking and old stock import.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-2xl font-bold">{summaryCards.total}</div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">In Stock</div>
            <div className="text-2xl font-bold text-green-700">{summaryCards.in_stock}</div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">Sold</div>
            <div className="text-2xl font-bold text-blue-700">{summaryCards.sold}</div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">Delivered / Other</div>
            <div className="text-2xl font-bold text-purple-700">{summaryCards.delivered_other}</div>
          </div>
        </div>

        {isOwnerAdmin && (
          <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold">Old Stock Excel Import</h2>
            <div className="flex flex-wrap gap-3 items-center">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border"
                onClick={downloadSample}
              >
                Download Sample Excel
              </button>

              <label className="px-4 py-2 rounded-xl bg-black text-white cursor-pointer">
                {uploading ? "Uploading..." : "Import Excel"}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) importExcel(file);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        )}

        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h2 className="text-lg font-semibold">Common Filters</h2>

            <div className="flex flex-col md:flex-row gap-3 flex-wrap">
              <select
                className="border rounded-xl px-3 py-2"
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
              >
                <option value="all">All Models</option>
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <input
                type="date"
                className="border rounded-xl px-3 py-2"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />

              <input
                type="date"
                className="border rounded-xl px-3 py-2"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />

              <input
                className="border rounded-xl px-3 py-2 w-full md:w-96"
                placeholder="Search model / variant / color / chassis / engine / source"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />

              <button
                type="button"
                className="px-4 py-2 rounded-xl border"
                onClick={() => {
                  setModelFilter("all");
                  setDateFrom("");
                  setDateTo("");
                  setQ("");
                  setStatusFilter("in_stock");
                  setOtherPreviewTitle("");
                  setOtherPreviewRows([]);
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h2 className="text-lg font-semibold">Stock Summary (Model / Variant / Color)</h2>

            <button
              type="button"
              className="px-4 py-2 rounded-xl border"
              onClick={exportSummary}
            >
              Export Summary
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">Loading summary...</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-2 border">Model</th>
                    <th className="p-2 border">Variant</th>
                    <th className="p-2 border">Color</th>
                    <th className="p-2 border">Total</th>
                    <th className="p-2 border">In Stock</th>
                    <th className="p-2 border">Sold</th>
                    <th className="p-2 border">Delivered</th>
                    <th className="p-2 border">Other</th>
                    <th className="p-2 border">Other Details</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.length ? (
                    <>
                      {summaryRows.map((r) => (
                        <tr key={r.key}>
                          <td className="p-2 border">{r.model_name}</td>
                          <td className="p-2 border">{r.variant_name}</td>
                          <td className="p-2 border">{r.display_color}</td>
                          <td className="p-2 border font-semibold">{r.total_qty}</td>
                          <td className="p-2 border text-green-700 font-semibold">{r.in_stock_qty}</td>
                          <td className="p-2 border text-blue-700 font-semibold">{r.sold_qty}</td>
                          <td className="p-2 border text-purple-700 font-semibold">{r.delivered_qty}</td>
                          <td className="p-2 border">{r.other_qty}</td>
                          <td className="p-2 border">
                            {r.other_qty > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded-lg border text-sm"
                                  onClick={() => showOtherDetailsByColor(r)}
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded-lg border text-sm"
                                  onClick={() => exportOtherDetailsByColor(r)}
                                >
                                  Download
                                </button>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-bold">
                        <td className="p-2 border" colSpan={3}>Grand Total</td>
                        <td className="p-2 border">{summaryTotals.total_qty}</td>
                        <td className="p-2 border text-green-700">{summaryTotals.in_stock_qty}</td>
                        <td className="p-2 border text-blue-700">{summaryTotals.sold_qty}</td>
                        <td className="p-2 border text-purple-700">{summaryTotals.delivered_qty}</td>
                        <td className="p-2 border">{summaryTotals.other_qty}</td>
                        <td className="p-2 border">-</td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td className="p-3 border text-center" colSpan={9}>
                        No summary stock found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h2 className="text-lg font-semibold">Stock Summary (Model / Variant Only)</h2>

            <button
              type="button"
              className="px-4 py-2 rounded-xl border"
              onClick={exportVariantOnly}
            >
              Export Variant Summary
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">Loading variant summary...</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-2 border">Model</th>
                    <th className="p-2 border">Variant</th>
                    <th className="p-2 border">Total</th>
                    <th className="p-2 border">In Stock</th>
                    <th className="p-2 border">Sold</th>
                    <th className="p-2 border">Delivered</th>
                    <th className="p-2 border">Other</th>
                    <th className="p-2 border">Other Details</th>
                  </tr>
                </thead>
                <tbody>
                  {variantOnlyRows.length ? (
                    <>
                      {variantOnlyRows.map((r) => (
                        <tr key={r.key}>
                          <td className="p-2 border">{r.model_name}</td>
                          <td className="p-2 border">{r.variant_name}</td>
                          <td className="p-2 border font-semibold">{r.total_qty}</td>
                          <td className="p-2 border text-green-700 font-semibold">{r.in_stock_qty}</td>
                          <td className="p-2 border text-blue-700 font-semibold">{r.sold_qty}</td>
                          <td className="p-2 border text-purple-700 font-semibold">{r.delivered_qty}</td>
                          <td className="p-2 border">{r.other_qty}</td>
                          <td className="p-2 border">
                            {r.other_qty > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded-lg border text-sm"
                                  onClick={() => showOtherDetailsByVariant(r)}
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded-lg border text-sm"
                                  onClick={() => exportOtherDetailsByVariant(r)}
                                >
                                  Download
                                </button>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-bold">
                        <td className="p-2 border" colSpan={2}>Grand Total</td>
                        <td className="p-2 border">{variantOnlyTotals.total_qty}</td>
                        <td className="p-2 border text-green-700">{variantOnlyTotals.in_stock_qty}</td>
                        <td className="p-2 border text-blue-700">{variantOnlyTotals.sold_qty}</td>
                        <td className="p-2 border text-purple-700">{variantOnlyTotals.delivered_qty}</td>
                        <td className="p-2 border">{variantOnlyTotals.other_qty}</td>
                        <td className="p-2 border">-</td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td className="p-3 border text-center" colSpan={8}>
                        No variant summary found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {otherPreviewRows.length > 0 && (
          <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <h2 className="text-lg font-semibold">{otherPreviewTitle}</h2>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border"
                  onClick={() => exportRowsAsDetailed("other_preview_details.csv", otherPreviewRows)}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border"
                  onClick={() => {
                    setOtherPreviewTitle("");
                    setOtherPreviewRows([]);
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-2 border">Chassis</th>
                    <th className="p-2 border">Engine</th>
                    <th className="p-2 border">Model</th>
                    <th className="p-2 border">Variant</th>
                    <th className="p-2 border">Color</th>
                    <th className="p-2 border">Status</th>
                    <th className="p-2 border">Purchase Source</th>
                    <th className="p-2 border">Document</th>
                    <th className="p-2 border">Stock Date</th>
                    <th className="p-2 border">Sale ID</th>
                  </tr>
                </thead>
                <tbody>
                  {otherPreviewRows.map((r) => (
                    <tr key={r.id}>
                      <td className="p-2 border">{r.chassis_number}</td>
                      <td className="p-2 border">{r.engine_number}</td>
                      <td className="p-2 border">{r.model_name || "-"}</td>
                      <td className="p-2 border">{r.variant_name || "-"}</td>
                      <td className="p-2 border">{colorDisplay(r.color)}</td>
                      <td className="p-2 border">
                        <Badge status={r.status_code} />
                      </td>
                      <td className="p-2 border">
                        <div>{r.purchase_from || "-"}</div>
                        <div className="text-xs text-gray-500">{r.entry_type || "-"}</div>
                      </td>
                      <td className="p-2 border">{r.document_number || r.invoice_number || "-"}</td>
                      <td className="p-2 border">{getStockDate(r) || "-"}</td>
                      <td className="p-2 border">{r.sale_id || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h2 className="text-lg font-semibold">Detailed Stock</h2>

            <div className="flex flex-col md:flex-row gap-3">
              <select
                className="border rounded-xl px-3 py-2"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="in_stock">In Stock</option>
                <option value="sold">Sold</option>
                <option value="delivered">Delivered</option>
                <option value="unlinked">Unlinked</option>
                <option value="duplicate">Duplicate</option>
                <option value="booked">Booked</option>
              </select>

              <button
                type="button"
                className="px-4 py-2 rounded-xl border"
                onClick={exportDetailed}
              >
                Export Detailed
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">Loading detailed stock...</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-2 border">Chassis</th>
                    <th className="p-2 border">Engine</th>
                    <th className="p-2 border">Model</th>
                    <th className="p-2 border">Variant</th>
                    <th className="p-2 border">Color</th>
                    <th className="p-2 border">Status</th>
                    <th className="p-2 border">Purchase Source</th>
                    <th className="p-2 border">Document</th>
                    <th className="p-2 border">Stock Date</th>
                    <th className="p-2 border">Sale ID</th>
                    <th className="p-2 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedRows.length ? (
                    <>
                      {detailedRows.map((r) => (
                        <tr key={r.id}>
                          <td className="p-2 border">{r.chassis_number}</td>
                          <td className="p-2 border">{r.engine_number}</td>
                          <td className="p-2 border">{r.model_name || "-"}</td>
                          <td className="p-2 border">{r.variant_name || "-"}</td>
                          <td className="p-2 border">{colorDisplay(r.color)}</td>
                          <td className="p-2 border">
                            <Badge status={r.status_code} />
                          </td>
                          <td className="p-2 border">
                            <div>{r.purchase_from || "-"}</div>
                            <div className="text-xs text-gray-500">{r.entry_type || "-"}</div>
                          </td>
                          <td className="p-2 border">{r.document_number || r.invoice_number || "-"}</td>
                          <td className="p-2 border">{getStockDate(r) || "-"}</td>
                          <td className="p-2 border">{r.sale_id || "-"}</td>
                          <td className="p-2 border">
                            <div className="flex flex-wrap gap-2">
                              {isOwnerAdminManager &&
                                String(r.status_code || "").toLowerCase() === "sold" && (
                                  <button
                                    className="px-2 py-1 rounded-lg border text-sm"
                                    onClick={() => markDelivered(r.id)}
                                  >
                                    Delivered
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-bold">
                        <td className="p-2 border" colSpan={2}>Grand Total</td>
                        <td className="p-2 border" colSpan={2}>{detailedTotals.total_qty} Vehicles</td>
                        <td className="p-2 border">-</td>
                        <td className="p-2 border">
                          In:{detailedTotals.in_stock_qty} / S:{detailedTotals.sold_qty}
                        </td>
                        <td className="p-2 border" colSpan={5}>
                          Delivered:{detailedTotals.delivered_qty} / Other:{detailedTotals.other_qty}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td className="p-3 border text-center" colSpan={11}>
                        No detailed stock found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}