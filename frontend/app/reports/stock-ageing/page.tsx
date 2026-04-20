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
  total_units: number;
  bucket_0_7: number;
  bucket_8_15: number;
  bucket_16_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
};

type BranchWiseRow = {
  branch_name: string;
  total_units: number;
  bucket_0_7: number;
  bucket_8_15: number;
  bucket_16_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
};

type ModelWiseRow = {
  model_label: string;
  total_units: number;
  bucket_0_7: number;
  bucket_8_15: number;
  bucket_16_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
};

type DetailRow = {
  id: number;
  inward_date: string;
  branch_name: string;
  vehicle_name: string;
  chassis_number: string;
  engine_number: string;
  status_code: string;
  customer_name: string;
  mobile_number: string;
  ageing_days: number;
  ageing_bucket: string;
};

function formatLocalDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-GB");
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

function bucketLabelFromDays(days: number) {
  if (days <= 7) return "0-7 Days";
  if (days <= 15) return "8-15 Days";
  if (days <= 30) return "16-30 Days";
  if (days <= 60) return "31-60 Days";
  if (days <= 90) return "61-90 Days";
  return "90+ Days";
}

function rowAlertClass(days: number) {
  if (days > 90) return "bg-red-50";
  if (days > 60) return "bg-orange-50";
  if (days > 30) return "bg-amber-50";
  return "";
}

function statusLabel(status?: string) {
  if (!status) return "-";
  if (status === "in_stock") return "In Stock";
  if (status === "sold") return "Sold";
  return status.replaceAll("_", " ");
}

function statusClasses(status?: string) {
  if (status === "sold") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (status === "in_stock") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  return "bg-slate-50 text-slate-700 ring-slate-200";
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

function BucketBar({
  label,
  value,
  max,
  barClass,
}: {
  label: string;
  value: number;
  max: number;
  barClass: string;
}) {
  const width = max > 0 ? `${Math.max(6, (value / max) * 100)}%` : "0%";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{value}</span>
      </div>
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${barClass}`} style={{ width }} />
      </div>
    </div>
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
    "#06b6d4",
    "#16a34a",
    "#ca8a04",
    "#ea580c",
    "#dc2626",
    "#7c3aed",
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

export default function StockAgeingReportPage() {
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showDetailed, setShowDetailed] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [summary, setSummary] = useState<Summary>({
    total_units: 0,
    bucket_0_7: 0,
    bucket_8_15: 0,
    bucket_16_30: 0,
    bucket_31_60: 0,
    bucket_61_90: 0,
    bucket_90_plus: 0,
  });
  const [branchWise, setBranchWise] = useState<BranchWiseRow[]>([]);
  const [modelWise, setModelWise] = useState<ModelWiseRow[]>([]);
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [filters, setFilters] = useState({
  asOnDate: formatLocalDate(new Date()),
  branchId: "",
  search: "",
  status: "in_stock",
});

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString("en-IN"));
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.asOnDate) params.set("asOnDate", filters.asOnDate);
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    return params.toString();
  }, [filters]);

  const exportUrl = useMemo(() => {
    return `${API_BASE}/api/reports/stock/ageing/export${queryString ? `?${queryString}` : ""}`;
  }, [queryString]);

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
        `${API_BASE}/api/reports/stock/ageing${queryString ? `?${queryString}` : ""}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Stock ageing API error:", res.status, text);
        throw new Error(`Stock ageing failed: ${res.status}`);
      }

      const data = await res.json();
      const payload = data?.data || data || {};

      setSummary(
        payload?.summary ||
          data?.summary || {
            total_units: 0,
            bucket_0_7: 0,
            bucket_8_15: 0,
            bucket_16_30: 0,
            bucket_31_60: 0,
            bucket_61_90: 0,
            bucket_90_plus: 0,
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

      setRows(
        Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(data?.rows)
          ? data.rows
          : []
      );
    } catch (error) {
      console.error("Failed to load stock ageing report", error);
      setSummary({
        total_units: 0,
        bucket_0_7: 0,
        bucket_8_15: 0,
        bucket_16_30: 0,
        bucket_31_60: 0,
        bucket_61_90: 0,
        bucket_90_plus: 0,
      });
      setBranchWise([]);
      setModelWise([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleApply = () => {
    fetchReport();
  };

const handleReset = () => {
  setFilters({
    asOnDate: formatLocalDate(new Date()),
    branchId: "",
    search: "",
    status: "in_stock",
  });

  setTimeout(() => {
    window.location.href = "/reports/stock-ageing";
  }, 0);
};

  const handlePrint = async () => {
    const includeDetailed = window.confirm(
      "Include Detailed Stock Ageing Table in print?"
    );

    setShowDetailed(includeDetailed);
    setPrinting(true);

    await new Promise((resolve) => setTimeout(resolve, 350));
    window.print();

    setTimeout(() => {
      setPrinting(false);
      setShowDetailed(true);
    }, 250);
  };

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

  const bucketCards = [
    {
      label: "Total Units",
      value: summary.total_units || 0,
      accent: "bg-slate-800",
      subtitle: "Current filtered stock units",
    },
    {
      label: "0-7 Days",
      value: summary.bucket_0_7 || 0,
      accent: "bg-blue-600",
    },
    {
      label: "8-15 Days",
      value: summary.bucket_8_15 || 0,
      accent: "bg-cyan-600",
    },
    {
      label: "16-30 Days",
      value: summary.bucket_16_30 || 0,
      accent: "bg-emerald-600",
    },
    {
      label: "31-60 Days",
      value: summary.bucket_31_60 || 0,
      accent: "bg-amber-500",
    },
    {
      label: "61-90 Days",
      value: summary.bucket_61_90 || 0,
      accent: "bg-orange-600",
    },
    {
      label: "90+ Days",
      value: summary.bucket_90_plus || 0,
      accent: "bg-rose-600",
      subtitle: "Urgent ageing bucket",
    },
  ];

  const bucketMax = Math.max(
    summary.bucket_0_7 || 0,
    summary.bucket_8_15 || 0,
    summary.bucket_16_30 || 0,
    summary.bucket_31_60 || 0,
    summary.bucket_61_90 || 0,
    summary.bucket_90_plus || 0,
    1
  );

  const bucketPieData = [
    { label: "0-7 Days", value: Number(summary.bucket_0_7 || 0) },
    { label: "8-15 Days", value: Number(summary.bucket_8_15 || 0) },
    { label: "16-30 Days", value: Number(summary.bucket_16_30 || 0) },
    { label: "31-60 Days", value: Number(summary.bucket_31_60 || 0) },
    { label: "61-90 Days", value: Number(summary.bucket_61_90 || 0) },
    { label: "90+ Days", value: Number(summary.bucket_90_plus || 0) },
  ];

  const topModel90Plus = modelWise
    .slice()
    .sort((a, b) => Number(b.bucket_90_plus || 0) - Number(a.bucket_90_plus || 0))
    .slice(0, 8)
    .map((row) => ({
      label: row.model_label,
      value: Number(row.bucket_90_plus || 0),
    }));

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

          .stock-ageing-print-root,
          .stock-ageing-print-root * {
            visibility: visible;
          }

          .stock-ageing-print-root {
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

          .compact-table table,
          .detailed-stock-ageing-table table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8.2px !important;
          }

          .compact-table thead,
          .detailed-stock-ageing-table thead {
            display: table-header-group !important;
          }

          .compact-table th,
          .compact-table td,
          .detailed-stock-ageing-table th,
          .detailed-stock-ageing-table td {
            border: 1px solid #dbe3ee !important;
            padding: 4px 5px !important;
            line-height: 1.15 !important;
            vertical-align: top !important;
            word-break: break-word !important;
          }

          .compact-table th,
          .detailed-stock-ageing-table th {
            background: #f8fafc !important;
            font-weight: 700 !important;
          }

          .compact-table tr,
          .detailed-stock-ageing-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-page-break {
            page-break-before: always !important;
            break-before: page !important;
          }
        }
      `}</style>

      <div className="stock-ageing-print-root">
    <div className="w-full max-w-none p-4 md:p-6 space-y-4 print-report-wrap">
          <div className="print-header hidden print:block">
            <div className="brand">GUPTA AUTO AGENCY</div>
            <h1>Stock Ageing Report</h1>
            <div className="meta">
              <div className="meta-item">
                <span className="meta-k">As On Date</span>
                <span className="meta-v">{formatDateOnly(filters.asOnDate)}</span>
              </div>
              <div className="meta-item">
                <span className="meta-k">Branch</span>
                <span className="meta-v">{selectedBranchLabel}</span>
              </div>
              <div className="meta-item">
                <span className="meta-k">Status</span>
                <span className="meta-v">{statusLabel(filters.status)}</span>
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
                  Stock Ageing Report
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Bucket-wise ageing view for filtered stock units.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowDetailed((prev) => !prev)}
                  className="inline-flex items-center rounded-xl bg-blue-600 text-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-blue-500"
                >
                  {showDetailed ? "Hide Detailed" : "Show Detailed"}
                </button>
                <PrintButton onClick={handlePrint} printing={printing} />
                <ExportButton url={exportUrl} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">
                    As On Date
                  </label>
                  <input
                    type="date"
                    value={filters.asOnDate}
                    onChange={(e) => handleChange("asOnDate", e.target.value)}
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

                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleChange("status", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="in_stock">In Stock</option>
                    <option value="sold">Sold</option>
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
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
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

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-500 shadow-sm">
              Loading stock ageing report...
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 summary-grid-print">
            {bucketCards.map((card) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value}
                accent={card.accent}
                subtitle={card.subtitle}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 print-two-col">
            <SectionCard
              title="Ageing Distribution"
              subtitle="Share of stock across ageing buckets"
              className="xl:col-span-1"
            >
              <SimplePieChart data={bucketPieData} title="Bucket Share" />
            </SectionCard>

            <SectionCard
              title="Bucket Trend Bars"
              subtitle="Quick visual comparison of ageing buckets"
              className="xl:col-span-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <BucketBar
                  label="0-7 Days"
                  value={summary.bucket_0_7 || 0}
                  max={bucketMax}
                  barClass="bg-blue-600"
                />
                <BucketBar
                  label="8-15 Days"
                  value={summary.bucket_8_15 || 0}
                  max={bucketMax}
                  barClass="bg-cyan-600"
                />
                <BucketBar
                  label="16-30 Days"
                  value={summary.bucket_16_30 || 0}
                  max={bucketMax}
                  barClass="bg-emerald-600"
                />
                <BucketBar
                  label="31-60 Days"
                  value={summary.bucket_31_60 || 0}
                  max={bucketMax}
                  barClass="bg-amber-500"
                />
                <BucketBar
                  label="61-90 Days"
                  value={summary.bucket_61_90 || 0}
                  max={bucketMax}
                  barClass="bg-orange-600"
                />
                <BucketBar
                  label="90+ Days"
                  value={summary.bucket_90_plus || 0}
                  max={bucketMax}
                  barClass="bg-rose-600"
                />
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-two-col">
            <SectionCard
              title="Top 90+ Ageing Models"
              subtitle="Models with the highest 90+ day ageing count"
            >
              <SimpleBarChart data={topModel90Plus} title="90+ Days by Model" />
            </SectionCard>

            <SectionCard
              title="Filter Summary"
              subtitle="Operational context for current ageing report"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    As On Date
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-800">
                    {formatDateOnly(filters.asOnDate)}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Branch
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-800">
                    {selectedBranchLabel}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-800">
                    {statusLabel(filters.status)}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Search
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-800 break-words">
                    {filters.search || "-"}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-two-col">
            <SectionCard
              title="Branch-wise Stock Ageing"
              subtitle="Ageing bucket split by branch"
              className="compact-table"
            >
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left px-3 py-2">Branch</th>
                      <th className="text-right px-3 py-2">Total</th>
                      <th className="text-right px-3 py-2">0-7</th>
                      <th className="text-right px-3 py-2">8-15</th>
                      <th className="text-right px-3 py-2">16-30</th>
                      <th className="text-right px-3 py-2">31-60</th>
                      <th className="text-right px-3 py-2">61-90</th>
                      <th className="text-right px-3 py-2">90+</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchWise.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                          {loading ? "Loading..." : "No branch ageing rows found"}
                        </td>
                      </tr>
                    ) : (
                      branchWise.map((row, index) => (
                        <tr key={index} className="border-t border-slate-200">
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {row.branch_name || "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {row.total_units || 0}
                          </td>
                          <td className="px-3 py-2 text-right">{row.bucket_0_7 || 0}</td>
                          <td className="px-3 py-2 text-right">{row.bucket_8_15 || 0}</td>
                          <td className="px-3 py-2 text-right">{row.bucket_16_30 || 0}</td>
                          <td className="px-3 py-2 text-right">{row.bucket_31_60 || 0}</td>
                          <td className="px-3 py-2 text-right">{row.bucket_61_90 || 0}</td>
                          <td className="px-3 py-2 text-right text-rose-700 font-semibold">
                            {row.bucket_90_plus || 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title="Model-wise Stock Ageing"
              subtitle="Ageing bucket split by model"
              className="compact-table"
            >
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left px-3 py-2">Model</th>
                      <th className="text-right px-3 py-2">Total</th>
                      <th className="text-right px-3 py-2">0-7</th>
                      <th className="text-right px-3 py-2">8-15</th>
                      <th className="text-right px-3 py-2">16-30</th>
                      <th className="text-right px-3 py-2">31-60</th>
                      <th className="text-right px-3 py-2">61-90</th>
                      <th className="text-right px-3 py-2">90+</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelWise.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                          {loading ? "Loading..." : "No model ageing rows found"}
                        </td>
                      </tr>
                    ) : (
                      modelWise.map((row, index) => (
                        <tr key={index} className="border-t border-slate-200">
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {row.model_label || "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {row.total_units || 0}
                          </td>
                          <td className="px-3 py-2 text-right">{row.bucket_0_7 || 0}</td>
                          <td className="px-3 py-2 text-right">{row.bucket_8_15 || 0}</td>
                          <td className="px-3 py-2 text-right">{row.bucket_16_30 || 0}</td>
                          <td className="px-3 py-2 text-right">{row.bucket_31_60 || 0}</td>
                          <td className="px-3 py-2 text-right">{row.bucket_61_90 || 0}</td>
                          <td className="px-3 py-2 text-right text-rose-700 font-semibold">
                            {row.bucket_90_plus || 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {showDetailed ? (
            <SectionCard
              title="Detailed Stock Ageing Table"
              subtitle="Vehicle-level ageing details"
              className="detailed-stock-ageing-table print-page-break"
            >
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-3 py-2">ID</th>
                      <th className="text-left px-3 py-2">Inward Date</th>
                      <th className="text-left px-3 py-2">Branch</th>
                      <th className="text-left px-3 py-2">Vehicle</th>
                      <th className="text-left px-3 py-2">Chassis</th>
                      <th className="text-left px-3 py-2">Engine</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-left px-3 py-2">Customer</th>
                      <th className="text-left px-3 py-2">Mobile</th>
                      <th className="text-right px-3 py-2">Ageing Days</th>
                      <th className="text-left px-3 py-2">Bucket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-3 py-6 text-center text-slate-500">
                          {loading ? "Loading..." : "No stock records found"}
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const ageingDays = Number(row.ageing_days || 0);
                        const bucketText =
                          row.ageing_bucket || bucketLabelFromDays(ageingDays);

                        return (
                          <tr
                            key={row.id}
                            className={`border-t border-slate-200 ${rowAlertClass(ageingDays)}`}
                          >
                            <td className="px-3 py-2">{row.id}</td>
                            <td className="px-3 py-2">
                              {row.inward_date ? String(row.inward_date).slice(0, 10) : ""}
                            </td>
                            <td className="px-3 py-2">{row.branch_name || ""}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {row.vehicle_name || ""}
                            </td>
                            <td className="px-3 py-2">{row.chassis_number || ""}</td>
                            <td className="px-3 py-2">{row.engine_number || ""}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses(
                                  row.status_code
                                )}`}
                              >
                                {statusLabel(row.status_code)}
                              </span>
                            </td>
                            <td className="px-3 py-2">{row.customer_name || ""}</td>
                            <td className="px-3 py-2">{row.mobile_number || ""}</td>
                            <td className="px-3 py-2 text-right font-semibold">
                              {ageingDays}
                            </td>
                            <td className="px-3 py-2">{bucketText}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : null}

          {!showDetailed ? (
            <div className="no-print rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
              Detailed stock ageing table is hidden.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}