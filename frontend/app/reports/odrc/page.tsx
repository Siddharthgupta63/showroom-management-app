"use client";

import { useEffect, useMemo, useState } from "react";
import ExportButton from "@/components/reports/ExportButton";
import { API_BASE } from "@/lib/apiBase";

type Branch = {
  id: number | string;
  name?: string;
  branch_name?: string;
  is_active?: number | boolean;
};

type Summary = {
  opening_stock: number;
  dispatch_count: number;
  retail_count: number;
  closing_stock: number;
};

type BranchWiseRow = {
  branch_name: string;
  opening_stock: number;
  dispatch_count: number;
  retail_count: number;
  closing_stock: number;
};

type ModelWiseRow = {
  model_label: string;
  opening_stock: number;
  dispatch_count: number;
  retail_count: number;
  closing_stock: number;
};

type SnapshotMode = "today" | "mtd" | "ytd";

type PurchaseSaleSnapshot = {
  purchaseCount: number;
  saleCount: number;
  saleAmount: number;
};

function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-GB");
}

function formatAmount(value?: number | string | null) {
  const num = Number(value || 0);
  return `₹${num.toLocaleString("en-IN")}`;
}

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${
      localStorage.getItem("token") ||
      localStorage.getItem("showroom_token") ||
      ""
    }`,
  };
}

function StatCard({
  label,
  value,
  accent,
  subtitle,
}: {
  label: string;
  value: string | number;
  accent: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm stat-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500 stat-label">{label}</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900 stat-value">
            {value}
          </div>
          {subtitle ? (
            <div className="mt-1 text-xs text-slate-500 stat-subvalue">{subtitle}</div>
          ) : null}
        </div>
        <div className={`h-10 w-2 rounded-full ${accent}`} />
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden report-card ${className}`}
    >
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
        <div className="text-lg font-semibold text-slate-900 section-title">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
      </div>
      <div className="p-5 section-body">{children}</div>
    </div>
  );
}

function PrintButton({
  onClick,
  printing,
}: {
  onClick: () => void;
  printing: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center rounded-xl bg-slate-800 text-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-700 no-print"
      disabled={printing}
    >
      {printing ? "Preparing..." : "Print"}
    </button>
  );
}

function SimplePieChart({
  data,
  title,
}: {
  data: { label: string; value: number }[];
  title: string;
}) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);

  const colors = [
    "#2563eb",
    "#16a34a",
    "#dc2626",
    "#ca8a04",
    "#7c3aed",
    "#0891b2",
    "#ea580c",
    "#475569",
  ];

  let start = 0;

  const slices = data.map((item, index) => {
    const value = Number(item.value || 0);
    const pct = total > 0 ? (value / total) * 100 : 0;
    const end = start + pct;

    const slice = {
      ...item,
      value,
      pct,
      start,
      end,
      color: colors[index % colors.length],
    };

    start = end;
    return slice;
  });

  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const angle = ((angleDeg - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const describeArc = (startPct: number, endPct: number) => {
    const startAngle = (startPct / 100) * 360;
    const endAngle = (endPct / 100) * 360;

    const outerStart = polarToCartesian(50, 50, 40, endAngle);
    const outerEnd = polarToCartesian(50, 50, 40, startAngle);
    const innerStart = polarToCartesian(50, 50, 22, endAngle);
    const innerEnd = polarToCartesian(50, 50, 22, startAngle);

    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
      "M",
      outerStart.x,
      outerStart.y,
      "A",
      40,
      40,
      0,
      largeArcFlag,
      0,
      outerEnd.x,
      outerEnd.y,
      "L",
      innerEnd.x,
      innerEnd.y,
      "A",
      22,
      22,
      0,
      largeArcFlag,
      1,
      innerStart.x,
      innerStart.y,
      "Z",
    ].join(" ");
  };

  return (
    <div className="space-y-4 chart-block">
      <div className="text-sm font-medium text-slate-700">{title}</div>

      {slices.length === 0 || total === 0 ? (
        <div className="flex items-center justify-center h-56 rounded-xl bg-slate-50 text-slate-400">
          No data available
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-center chart-wrap">
          <div className="w-full flex justify-center">
            <svg viewBox="0 0 100 100" className="w-44 h-44 print-chart-svg">
              {slices.map((slice, index) => (
                <path
                  key={index}
                  d={describeArc(slice.start, slice.end)}
                  fill={slice.color}
                />
              ))}
              <circle cx="50" cy="50" r="16" fill="white" />
            </svg>
          </div>

          <div className="space-y-2 flex-1">
            {slices.map((slice, idx) => {
              const pct = total ? ((slice.value / total) * 100).toFixed(1) : "0.0";
              return (
                <div key={idx} className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="truncate">{slice.label}</span>
                  </div>
                  <div className="text-slate-600 shrink-0">
                    {slice.value} ({pct}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SimpleBarChart({
  data,
  title,
}: {
  data: { label: string; value: number }[];
  title: string;
}) {
  const max = Math.max(...data.map((d) => Number(d.value || 0)), 1);

  return (
    <div className="chart-block">
      <div className="font-semibold mb-3 text-slate-700">{title}</div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-56 rounded-xl bg-slate-50 text-slate-400">
          No data available
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item, index) => {
            const width = `${(Number(item.value || 0) / max) * 100}%`;
            return (
              <div key={index}>
                <div className="flex justify-between text-sm mb-1 gap-3">
                  <span className="truncate text-slate-700">{item.label}</span>
                  <span className="text-slate-500 shrink-0">{item.value}</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getDateWindow(mode: SnapshotMode) {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);

  if (mode === "today") {
    return { from: end, to: end, label: "Today" };
  }

  if (mode === "mtd") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    return { from, to: end, label: "MTD" };
  }

  const from = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
  return { from, to: end, label: "YTD" };
}

export default function OdrcReportPage() {
  const [loading, setLoading] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [snapshotMode, setSnapshotMode] = useState<SnapshotMode>("today");

  const [summary, setSummary] = useState<Summary>({
    opening_stock: 0,
    dispatch_count: 0,
    retail_count: 0,
    closing_stock: 0,
  });

  const [branchWise, setBranchWise] = useState<BranchWiseRow[]>([]);
  const [modelWise, setModelWise] = useState<ModelWiseRow[]>([]);

  const [snapshot, setSnapshot] = useState<PurchaseSaleSnapshot>({
    purchaseCount: 0,
    saleCount: 0,
    saleAmount: 0,
  });

  const [filters, setFilters] = useState({
    reportDate: new Date().toISOString().slice(0, 10),
    branchId: "",
    search: "",
  });

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString("en-IN"));
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.reportDate) params.set("reportDate", filters.reportDate);
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.search) params.set("search", filters.search);
    return params.toString();
  }, [filters]);

  const exportUrl = useMemo(() => {
    return `${API_BASE}/api/reports/stock/odrc/export${queryString ? `?${queryString}` : ""}`;
  }, [queryString]);

  const activeBranches = useMemo(
    () =>
      branches
        .filter((b) => b.is_active !== 0)
        .map((b) => ({
          value: String(b.id),
          label: b.name || b.branch_name || `Branch ${b.id}`,
        })),
    [branches]
  );

  const selectedBranchLabel = useMemo(() => {
    const found = activeBranches.find((b) => b.value === filters.branchId);
    return found?.label || "All Branches";
  }, [activeBranches, filters.branchId]);

  const snapshotWindow = useMemo(() => getDateWindow(snapshotMode), [snapshotMode]);

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/branches`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error(`Branches API failed: ${res.status}`);
      const data = await res.json();

      if (Array.isArray(data)) setBranches(data);
      else if (Array.isArray(data?.rows)) setBranches(data.rows);
      else if (Array.isArray(data?.data)) setBranches(data.data);
      else setBranches([]);
    } catch (error) {
      console.error("Failed to load branches", error);
      setBranches([]);
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/api/reports/stock/odrc${queryString ? `?${queryString}` : ""}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("ODRC API error:", res.status, text);
        throw new Error(`ODRC failed: ${res.status}`);
      }

      const data = await res.json();
      const payload = data?.data || data || {};

      setSummary(
        payload?.summary ||
          data?.summary || {
            opening_stock: 0,
            dispatch_count: 0,
            retail_count: 0,
            closing_stock: 0,
          }
      );

      setBranchWise(
        Array.isArray(payload?.branchWise)
          ? payload.branchWise
          : Array.isArray(data?.branchWise)
          ? data.branchWise
          : []
      );

      setModelWise(
        Array.isArray(payload?.modelWise)
          ? payload.modelWise
          : Array.isArray(data?.modelWise)
          ? data.modelWise
          : []
      );
    } catch (error) {
      console.error("Failed to load ODRC report", error);
      setSummary({
        opening_stock: 0,
        dispatch_count: 0,
        retail_count: 0,
        closing_stock: 0,
      });
      setBranchWise([]);
      setModelWise([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSnapshot = async () => {
    try {
      setSnapshotLoading(true);

      const { from, to } = snapshotWindow;

      const purchaseParams = new URLSearchParams({
        from,
        to,
        page: "1",
        pageSize: "1",
      });

      const salesParams = new URLSearchParams({
        fromDate: from,
        toDate: to,
      });

      if (filters.search) {
        purchaseParams.set("q", filters.search);
        salesParams.set("search", filters.search);
      }

      const [purchaseRes, salesRes] = await Promise.all([
        fetch(`${API_BASE}/api/purchases?${purchaseParams.toString()}`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE}/api/reports/sales/analytics?${salesParams.toString()}`, {
          headers: getAuthHeaders(),
        }),
      ]);

      const purchaseJson = purchaseRes.ok ? await purchaseRes.json() : {};
      const salesJson = salesRes.ok ? await salesRes.json() : {};

      const salesPayload = salesJson?.data || salesJson || {};
      const salesSummary = salesPayload?.summary || salesJson?.summary || {};

      setSnapshot({
        purchaseCount: Number(purchaseJson?.total || 0),
        saleCount: Number(salesSummary?.total_sales || 0),
        saleAmount: Number(salesSummary?.total_amount || 0),
      });
    } catch (error) {
      console.error("Failed to load ODRC snapshot", error);
      setSnapshot({
        purchaseCount: 0,
        saleCount: 0,
        saleAmount: 0,
      });
    } finally {
      setSnapshotLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotMode, filters.search]);

  const handleChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleApply = () => {
    fetchReport();
  };

  const handleReset = () => {
    setFilters({
      reportDate: new Date().toISOString().slice(0, 10),
      branchId: "",
      search: "",
    });

    setSnapshotMode("today");

    setTimeout(() => {
      window.location.href = "/reports/odrc";
    }, 0);
  };

  const handlePrint = async () => {
    setPrinting(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    window.print();
    setTimeout(() => setPrinting(false), 250);
  };

  const summaryPieData = [
    { label: "Opening", value: Number(summary.opening_stock || 0) },
    { label: "Dispatch", value: Number(summary.dispatch_count || 0) },
    { label: "Retail", value: Number(summary.retail_count || 0) },
    { label: "Closing", value: Number(summary.closing_stock || 0) },
  ];

  const topModelClosing = modelWise
    .slice()
    .sort((a, b) => Number(b.closing_stock || 0) - Number(a.closing_stock || 0))
    .slice(0, 8)
    .map((x) => ({
      label: x.model_label,
      value: Number(x.closing_stock || 0),
    }));

  const snapshotNet = Number(snapshot.purchaseCount || 0) - Number(snapshot.saleCount || 0);

  return (
    <div className="report-container min-h-screen bg-slate-50">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          html,
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body * {
            visibility: hidden;
          }

          .odrc-report-print-root,
          .odrc-report-print-root * {
            visibility: visible;
          }

          .odrc-report-print-root {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
          }

          .no-print,
          aside,
          nav,
          button {
            display: none !important;
          }

          .print-report-wrap {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-header {
            display: block !important;
            margin-bottom: 8px !important;
            border: 1px solid #dbe3ee !important;
            border-left: 5px solid #0f172a !important;
            border-radius: 10px !important;
            padding: 10px 12px !important;
            break-inside: avoid !important;
          }

          .print-header h1 {
            font-size: 18px !important;
            line-height: 1.1 !important;
            margin: 0 !important;
            font-weight: 800 !important;
          }

          .print-header .brand {
            font-size: 12px !important;
            font-weight: 700 !important;
            color: #0f172a !important;
            margin-bottom: 2px !important;
          }

          .print-header .meta {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 6px !important;
            margin-top: 8px !important;
          }

          .print-header .meta-item {
            border: 1px solid #e2e8f0 !important;
            border-radius: 8px !important;
            padding: 6px 8px !important;
            background: #fafafa !important;
          }

          .print-header .meta-k {
            display: block !important;
            font-size: 9px !important;
            color: #64748b !important;
            margin-bottom: 2px !important;
          }

          .print-header .meta-v {
            display: block !important;
            font-size: 10px !important;
            font-weight: 600 !important;
          }

          .summary-grid-print {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 8px !important;
            margin-bottom: 8px !important;
          }

          .snapshot-grid-print {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 8px !important;
            margin-bottom: 8px !important;
          }

          .stat-card {
            box-shadow: none !important;
            border: 1px solid #dbe3ee !important;
            border-radius: 10px !important;
            padding: 8px 10px !important;
            break-inside: avoid !important;
          }

          .stat-label {
            font-size: 9px !important;
          }

          .stat-value {
            font-size: 20px !important;
            line-height: 1.1 !important;
            margin-top: 4px !important;
          }

          .stat-subvalue {
            font-size: 8px !important;
          }

          .report-card {
            box-shadow: none !important;
            border: 1px solid #dbe3ee !important;
            border-radius: 10px !important;
            break-inside: avoid !important;
          }

          .section-title {
            font-size: 12px !important;
          }

          .section-body {
            padding: 10px !important;
          }

          .chart-wrap {
            grid-template-columns: 150px 1fr !important;
            gap: 10px !important;
          }

          .print-chart-svg {
            width: 125px !important;
            height: 125px !important;
          }

          .print-two-col {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }

          .compact-table table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8.4px !important;
          }

          .compact-table thead {
            display: table-header-group !important;
          }

          .compact-table th,
          .compact-table td {
            border: 1px solid #dbe3ee !important;
            padding: 4px 5px !important;
            line-height: 1.15 !important;
            vertical-align: top !important;
            word-break: break-word !important;
          }

          .compact-table th {
            background: #f8fafc !important;
            font-weight: 700 !important;
          }

          .compact-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="odrc-report-print-root">
       <div className="w-full max-w-none p-4 md:p-6 space-y-4 print-report-wrap">
          <div className="print-header hidden print:block">
            <div className="brand">GUPTA AUTO AGENCY</div>
            <h1>ODRC Report</h1>
            <div className="meta">
              <div className="meta-item">
                <span className="meta-k">Report Date</span>
                <span className="meta-v">{formatDateOnly(filters.reportDate)}</span>
              </div>
              <div className="meta-item">
                <span className="meta-k">Branch</span>
                <span className="meta-v">{selectedBranchLabel}</span>
              </div>
              <div className="meta-item">
                <span className="meta-k">Snapshot</span>
                <span className="meta-v">{snapshotWindow.label}</span>
              </div>
              <div className="meta-item">
                <span className="meta-k">Generated</span>
                <span className="meta-v">{generatedAt || new Date().toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 no-print">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  ODRC Report
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Opening Stock, Dispatch, Retail and Closing Stock with Today / MTD / YTD snapshot.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <PrintButton onClick={handlePrint} printing={printing} />
                <ExportButton url={exportUrl} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">
                    Report Date
                  </label>
                  <input
                    type="date"
                    value={filters.reportDate}
                    onChange={(e) => handleChange("reportDate", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">
                    Branch
                  </label>
                  <select
                    value={filters.branchId}
                    onChange={(e) => handleChange("branchId", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Branches</option>
                    {activeBranches.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="xl:col-span-2">
                  <label className="block text-sm font-medium mb-1 text-slate-700">
                    Search
                  </label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleChange("search", e.target.value)}
                    placeholder="Model / Variant / Chassis / Engine / Customer / Mobile"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <button
                    onClick={handleApply}
                    className="rounded-xl bg-blue-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-500"
                  >
                    Apply
                  </button>
                  <button
                    onClick={handleReset}
                    className="rounded-xl border border-slate-300 bg-white text-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-500 shadow-sm">
              Loading ODRC report...
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 summary-grid-print">
            <StatCard
              label="Opening Stock"
              value={summary.opening_stock || 0}
              accent="bg-blue-600"
              subtitle="Opening count for selected date"
            />
            <StatCard
              label="Dispatch"
              value={summary.dispatch_count || 0}
              accent="bg-amber-500"
              subtitle="Vehicles dispatched"
            />
            <StatCard
              label="Retail"
              value={summary.retail_count || 0}
              accent="bg-emerald-600"
              subtitle="Vehicles retailed"
            />
            <StatCard
              label="Closing Stock"
              value={summary.closing_stock || 0}
              accent="bg-rose-600"
              subtitle="Net closing stock"
            />
          </div>

          <SectionCard
            title="Purchase vs Sale Snapshot"
            subtitle={`Current snapshot mode: ${snapshotWindow.label}`}
          >
            <div className="flex flex-wrap gap-2 mb-4 no-print">
              <button
                onClick={() => setSnapshotMode("today")}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  snapshotMode === "today"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setSnapshotMode("mtd")}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  snapshotMode === "mtd"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700"
                }`}
              >
                MTD
              </button>
              <button
                onClick={() => setSnapshotMode("ytd")}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  snapshotMode === "ytd"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700"
                }`}
              >
                YTD
              </button>
            </div>

            {snapshotLoading ? (
              <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-slate-500">
                Loading snapshot...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 snapshot-grid-print">
                <StatCard
                  label={`${snapshotWindow.label} Purchases`}
                  value={snapshot.purchaseCount}
                  accent="bg-cyan-600"
                  subtitle={`${formatDateOnly(snapshotWindow.from)} to ${formatDateOnly(snapshotWindow.to)}`}
                />
                <StatCard
                  label={`${snapshotWindow.label} Sales`}
                  value={snapshot.saleCount}
                  accent="bg-emerald-600"
                  subtitle="Sales count from analytics"
                />
                <StatCard
                  label={`${snapshotWindow.label} Sales Amount`}
                  value={formatAmount(snapshot.saleAmount)}
                  accent="bg-violet-600"
                  subtitle="Total sales value"
                />
                <StatCard
                  label={`${snapshotWindow.label} Net Units`}
                  value={snapshotNet}
                  accent={snapshotNet >= 0 ? "bg-blue-600" : "bg-rose-600"}
                  subtitle="Purchases minus Sales"
                />
              </div>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-two-col">
            <SectionCard
              title="ODRC Summary Pie Chart"
              subtitle="Opening, Dispatch, Retail and Closing split"
            >
              <SimplePieChart data={summaryPieData} title="ODRC Split" />
            </SectionCard>

            <SectionCard
              title="Top Closing Stock Models"
              subtitle="Highest closing stock models"
            >
              <SimpleBarChart data={topModelClosing} title="Closing Stock by Model" />
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-two-col">
            <SectionCard
              title="Branch-wise ODRC"
              subtitle="Operational split by branch"
              className="compact-table"
            >
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left px-3 py-2">Branch</th>
                      <th className="text-right px-3 py-2">Opening</th>
                      <th className="text-right px-3 py-2">Dispatch</th>
                      <th className="text-right px-3 py-2">Retail</th>
                      <th className="text-right px-3 py-2">Closing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchWise.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                          {loading ? "Loading..." : "No branch records found"}
                        </td>
                      </tr>
                    ) : (
                      branchWise.map((row, index) => (
                        <tr key={index} className="border-t border-slate-200">
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {row.branch_name || "-"}
                          </td>
                          <td className="px-3 py-2 text-right">{row.opening_stock || 0}</td>
                          <td className="px-3 py-2 text-right">{row.dispatch_count || 0}</td>
                          <td className="px-3 py-2 text-right">{row.retail_count || 0}</td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {row.closing_stock || 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title="Model-wise ODRC"
              subtitle="Operational split by model"
              className="compact-table"
            >
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left px-3 py-2">Model</th>
                      <th className="text-right px-3 py-2">Opening</th>
                      <th className="text-right px-3 py-2">Dispatch</th>
                      <th className="text-right px-3 py-2">Retail</th>
                      <th className="text-right px-3 py-2">Closing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelWise.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                          {loading ? "Loading..." : "No model records found"}
                        </td>
                      </tr>
                    ) : (
                      modelWise.map((row, index) => (
                        <tr key={index} className="border-t border-slate-200">
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {row.model_label || "-"}
                          </td>
                          <td className="px-3 py-2 text-right">{row.opening_stock || 0}</td>
                          <td className="px-3 py-2 text-right">{row.dispatch_count || 0}</td>
                          <td className="px-3 py-2 text-right">{row.retail_count || 0}</td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {row.closing_stock || 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}