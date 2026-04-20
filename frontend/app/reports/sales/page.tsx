"use client";

import { useEffect, useMemo, useState } from "react";
import ReportFilters from "@/components/reports/ReportFilters";
import ExportButton from "@/components/reports/ExportButton";
import { API_BASE } from "@/lib/apiBase";

type SalesRow = {
  id: number;
  sale_date: string;
  invoice_number: string;
  customer_name: string;
  mobile_number: string;
  vehicle_model: string;
  chassis_number: string;
  engine_number: string;
  branch_name?: string;
  sale_price: number;
};

type Branch = {
  id: number | string;
  name?: string;
  branch_name?: string;
  is_active?: number | boolean;
};

type Summary = {
  total_sales: number;
  total_amount: number;
  total_ex_showroom: number;
  total_insurance: number;
  total_accessories: number;
};

type ModelWiseRow = {
  vehicle_model: string;
  retail_count: number;
  total_amount: number;
  avg_amount: number;
};

type BranchWiseRow = {
  branch_name: string;
  retail_count: number;
  total_amount: number;
};

type DateWiseRow = {
  day_no: number;
  retail_count: number;
  total_amount: number;
};

type MonthWiseRow = {
  month_key: string;
  month_label: string;
  retail_count: number;
  total_amount: number;
};

type FilterState = {
  fromDate: string;
  toDate: string;
  branchId: string;
  search: string;
};

type PrintOptions = {
  summary: boolean;
  branchPie: boolean;
  modelPie: boolean;
  dateChart: boolean;
  monthChart: boolean;
  modelTable: boolean;
  monthTable: boolean;
  detailedTable: boolean;
};

function formatAmount(value: number | string | null | undefined) {
  const n = Number(value || 0);
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB");
}

function formatLocalDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getFinancialYearStartLocal(date: Date) {
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return new Date(year, 3, 1);
}

function getMonthStartLocal(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getDefaultDates(range: "TODAY" | "MTD" | "YTD" | "CUSTOM") {
  const today = new Date();
  const to = formatLocalDate(today);

  if (range === "TODAY") {
    return { fromDate: to, toDate: to };
  }

  if (range === "MTD") {
    return {
      fromDate: formatLocalDate(getMonthStartLocal(today)),
      toDate: to,
    };
  }

  if (range === "YTD") {
    return {
      fromDate: formatLocalDate(getFinancialYearStartLocal(today)),
      toDate: to,
    };
  }

  return {
    fromDate: formatLocalDate(getMonthStartLocal(today)),
    toDate: to,
  };
}

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-300 bg-white shadow-sm overflow-hidden report-card ${className}`}>
      <div className="px-4 py-3 border-b border-slate-300 bg-slate-50 font-semibold section-title text-slate-900">
        {title}
      </div>
      <div className="p-4 section-body">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "bg-blue-600",
  subtitle,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white shadow-sm p-4 report-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
          {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
        </div>
        <div className={`w-2 h-12 rounded-full ${accent}`} />
      </div>
    </div>
  );
}

function PrintOptionsModal({
  open,
  options,
  setOptions,
  onClose,
  onConfirm,
}: {
  open: boolean;
  options: PrintOptions;
  setOptions: React.Dispatch<React.SetStateAction<PrintOptions>>;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  const toggle = (key: keyof PrintOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const CheckRow = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: boolean;
    onChange: () => void;
  }) => (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-3 py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <input type="checkbox" checked={value} onChange={onChange} className="h-4 w-4" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4 no-print">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-300 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="text-lg font-semibold text-slate-900">Print Options</div>
          <div className="mt-1 text-sm text-slate-500">
            Choose what to include in the printed sales report.
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <CheckRow label="Summary Cards" value={options.summary} onChange={() => toggle("summary")} />
          <CheckRow label="Branch Pie" value={options.branchPie} onChange={() => toggle("branchPie")} />
          <CheckRow label="Model Pie" value={options.modelPie} onChange={() => toggle("modelPie")} />
          <CheckRow label="Date Chart" value={options.dateChart} onChange={() => toggle("dateChart")} />
          <CheckRow label="Month Chart" value={options.monthChart} onChange={() => toggle("monthChart")} />
          <CheckRow label="Model Table" value={options.modelTable} onChange={() => toggle("modelTable")} />
          <CheckRow label="Month Table" value={options.monthTable} onChange={() => toggle("monthTable")} />
          <CheckRow
            label="Detailed Sales Table"
            value={options.detailedTable}
            onChange={() => toggle("detailedTable")}
          />
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700"
          >
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-slate-900 text-white">
            Print
          </button>
        </div>
      </div>
    </div>
  );
}

function SimplePieChart({
  title,
  rows,
  labelKey,
  valueKey,
}: {
  title: string;
  rows: any[];
  labelKey: string;
  valueKey: string;
}) {
  const total = rows.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0);
  const colors = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#475569", "#ea580c"];

  let running = 0;
  const slices = rows.map((row, idx) => {
    const value = Number(row[valueKey] || 0);
    const pct = total > 0 ? (value / total) * 100 : 0;
    const start = running;
    const end = running + pct;
    running = end;
    return {
      label: row[labelKey] || "-",
      value,
      pct,
      start,
      end,
      color: colors[idx % colors.length],
    };
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
    <div className="chart-block">
      <div className="mb-4 text-sm font-semibold text-slate-700">{title}</div>

      {rows.length === 0 || total === 0 ? (
        <div className="h-52 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
          No data available
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-center chart-wrap">
          <div className="flex justify-center">
            <svg viewBox="0 0 100 100" className="w-44 h-44 print-chart-svg">
              {slices.map((slice, i) => (
                <path key={i} d={describeArc(slice.start, slice.end)} fill={slice.color} />
              ))}
              <circle cx="50" cy="50" r="16" fill="white" />
            </svg>
          </div>

          <div className="space-y-2">
            {slices.map((slice, i) => (
              <div key={i} className="flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate">{slice.label}</span>
                </div>
                <div className="shrink-0 text-slate-600">
                  {slice.value} ({slice.pct.toFixed(1)}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HorizontalBars({
  title,
  rows,
  labelKey,
  valueKey,
  colorClass = "bg-blue-600",
}: {
  title: string;
  rows: any[];
  labelKey: string;
  valueKey: string;
  colorClass?: string;
}) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey] || 0)), 1);

  return (
    <div className="chart-block">
      <div className="mb-4 text-sm font-semibold text-slate-700">{title}</div>

      {rows.length === 0 ? (
        <div className="h-52 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
          No data available
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => {
            const width = `${(Number(row[valueKey] || 0) / max) * 100}%`;
            return (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1 gap-3">
                  <span className="truncate text-slate-700">{row[labelKey] || "-"}</span>
                  <span className="shrink-0 text-slate-500">{row[valueKey] || 0}</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${colorClass}`} style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SalesReportPage() {
  const initialDates = useMemo(() => getDefaultDates("MTD"), []);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    fromDate: initialDates.fromDate,
    toDate: initialDates.toDate,
    branchId: "",
    search: "",
  });

  const [summary, setSummary] = useState<Summary>({
    total_sales: 0,
    total_amount: 0,
    total_ex_showroom: 0,
    total_insurance: 0,
    total_accessories: 0,
  });
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [modelWise, setModelWise] = useState<ModelWiseRow[]>([]);
  const [branchWise, setBranchWise] = useState<BranchWiseRow[]>([]);
  const [dateWise, setDateWise] = useState<DateWiseRow[]>([]);
  const [monthWise, setMonthWise] = useState<MonthWiseRow[]>([]);

  const [printOptions, setPrintOptions] = useState<PrintOptions>({
    summary: true,
    branchPie: true,
    modelPie: true,
    dateChart: true,
    monthChart: true,
    modelTable: true,
    monthTable: true,
    detailedTable: true,
  });

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString("en-IN"));
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.fromDate) params.set("fromDate", filters.fromDate);
    if (filters.toDate) params.set("toDate", filters.toDate);
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.search) params.set("search", filters.search);
    return params.toString();
  }, [filters]);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams(queryString);
    params.set("includeDetails", "1");
    return `${API_BASE}/api/reports/sales/export?${params.toString()}`;
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

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/branches`, {
        headers: {
          Authorization: `Bearer ${
            localStorage.getItem("token") ||
            localStorage.getItem("showroom_token") ||
            ""
          }`,
        },
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
        `${API_BASE}/api/reports/sales/analytics${queryString ? `?${queryString}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${
              localStorage.getItem("token") ||
              localStorage.getItem("showroom_token") ||
              ""
            }`,
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Sales report API error:", res.status, text);
        throw new Error(`Sales report failed: ${res.status}`);
      }

      const data = await res.json();
      const payload = data?.data || data || {};

      setSummary(
        payload?.summary || {
          total_sales: 0,
          total_amount: 0,
          total_ex_showroom: 0,
          total_insurance: 0,
          total_accessories: 0,
        }
      );
      setRows(Array.isArray(payload?.rows) ? payload.rows : []);
      setModelWise(Array.isArray(payload?.modelWise) ? payload.modelWise : []);
      setBranchWise(Array.isArray(payload?.branchWise) ? payload.branchWise : []);
      setDateWise(Array.isArray(payload?.dateWise) ? payload.dateWise : []);
      setMonthWise(Array.isArray(payload?.monthWise) ? payload.monthWise : []);
    } catch (error) {
      console.error("Failed to load sales report", error);
      setSummary({
        total_sales: 0,
        total_amount: 0,
        total_ex_showroom: 0,
        total_insurance: 0,
        total_accessories: 0,
      });
      setRows([]);
      setModelWise([]);
      setBranchWise([]);
      setDateWise([]);
      setMonthWise([]);
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
    const resetDates = getDefaultDates("MTD");
    setFilters({
      fromDate: resetDates.fromDate,
      toDate: resetDates.toDate,
      branchId: "",
      search: "",
    });

    setTimeout(() => {
      window.location.href = "/reports/sales";
    }, 0);
  };

  const applyPreset = (preset: "TODAY" | "MTD" | "YTD" | "CUSTOM") => {
    if (preset === "CUSTOM") return;
    const next = getDefaultDates(preset);
    setFilters((prev) => ({
      ...prev,
      fromDate: next.fromDate,
      toDate: next.toDate,
    }));
  };

  const handlePrintOpen = () => {
    const includeDetailed = window.confirm("Do you want to print detailed sales report also?");
    setPrintOptions((prev) => ({
      ...prev,
      detailedTable: includeDetailed,
    }));
    setShowPrintOptions(true);
  };

  const handlePrintConfirm = async () => {
    setShowPrintOptions(false);
    setPrinting(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    window.print();
    setTimeout(() => setPrinting(false), 250);
  };

  const branchPieRows = branchWise.slice(0, 8);
  const modelPieRows = modelWise.slice(0, 10);
  const monthChartRows = monthWise.slice(0, 12);

  return (
    <div className="report-container min-h-screen bg-slate-50">
      <style jsx global>{`
        .print-only {
          display: none;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          html,
          body {
            background: #ffffff !important;
            color: #111827 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body * {
            visibility: hidden;
          }

          .sales-report-print-root,
          .sales-report-print-root * {
            visibility: visible;
          }

          .sales-report-print-root {
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

          .print-only {
            display: block !important;
          }

          .print-report-wrap {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-header {
            display: block !important;
            margin-bottom: 10px !important;
            border: 1px solid #d1d5db !important;
            border-left: 5px solid #111827 !important;
            border-radius: 12px !important;
            padding: 10px 12px !important;
          }

          .print-header-title {
            display: flex !important;
            justify-content: space-between !important;
            gap: 16px !important;
            align-items: start !important;
          }

          .print-header h1 {
            font-size: 18px !important;
            line-height: 1.1 !important;
            margin: 0 !important;
            font-weight: 800 !important;
          }

          .brand {
            font-size: 12px !important;
            font-weight: 700 !important;
            color: #111827 !important;
            margin-bottom: 2px !important;
          }

          .print-subtitle {
            font-size: 9px !important;
            color: #6b7280 !important;
          }

          .print-meta-grid {
            display: grid !important;
            grid-template-columns: repeat(5, 1fr) !important;
            gap: 6px !important;
            margin-top: 8px !important;
          }

          .print-meta-item {
            border: 1px solid #e5e7eb !important;
            border-radius: 8px !important;
            padding: 6px 8px !important;
            background: #fafafa !important;
          }

          .print-meta-item .k {
            display: block !important;
            font-size: 9px !important;
            color: #6b7280 !important;
            margin-bottom: 2px !important;
          }

          .print-meta-item .v {
            display: block !important;
            font-size: 10px !important;
            font-weight: 600 !important;
            color: #111827 !important;
          }

          .summary-grid-print {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 8px !important;
            margin-bottom: 8px !important;
          }

          .print-two-col {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }

          .report-card {
            box-shadow: none !important;
            border: 1px solid #d1d5db !important;
            border-radius: 10px !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .section-title {
            font-size: 12px !important;
          }

          .section-body {
            padding: 10px !important;
          }

          .chart-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .chart-wrap {
            grid-template-columns: 150px 1fr !important;
            gap: 10px !important;
          }

          .print-chart-svg {
            width: 120px !important;
            height: 120px !important;
          }

          .compact-month-chart .section-body {
            min-height: auto !important;
          }

          .compact-table table,
          .screen-detailed-sales-table table,
          .print-detailed-sales-table table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          .compact-table thead,
          .screen-detailed-sales-table thead,
          .print-detailed-sales-table thead {
            display: table-header-group !important;
          }

          .compact-table th,
          .compact-table td {
            border: 1px solid #d1d5db !important;
            padding: 4px 6px !important;
            font-size: 8.8px !important;
            line-height: 1.2 !important;
            vertical-align: top !important;
            word-break: break-word !important;
          }

          .screen-detailed-sales-table th,
          .screen-detailed-sales-table td,
          .print-detailed-sales-table th,
          .print-detailed-sales-table td {
            border: 1px solid #d1d5db !important;
            padding: 3px 5px !important;
            font-size: 8px !important;
            line-height: 1.15 !important;
            vertical-align: top !important;
            word-break: break-word !important;
          }

          .compact-table th,
          .screen-detailed-sales-table th,
          .print-detailed-sales-table th {
            background: #f3f4f6 !important;
            font-weight: 700 !important;
          }

          .compact-table tr,
          .screen-detailed-sales-table tr,
          .print-detailed-sales-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .screen-detailed-sales-table .hide-in-print,
          .print-detailed-sales-table .hide-in-print {
            display: none !important;
          }

          .screen-title {
            margin-bottom: 14px !important;
          }

          .loading-text {
            display: none !important;
          }

          .hide-section-in-print {
            display: none !important;
          }

          .print-page-break {
            page-break-before: always !important;
            break-before: page !important;
          }

          /* HIDE SCREEN DETAILED CARD IN PRINT */
          .screen-detailed-wrapper {
            display: none !important;
          }

          /* PRINT DETAILED TABLE MUST BE PAGE-BREAKABLE */
          .print-detailed-wrapper {
            display: block !important;
            page-break-before: always !important;
            break-before: page !important;
          }

          .print-detailed-card {
            display: block !important;
            box-shadow: none !important;
            border: 1px solid #d1d5db !important;
            border-radius: 10px !important;
            overflow: visible !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          .print-detailed-card .print-detailed-head {
            padding: 10px 12px !important;
            border-bottom: 1px solid #d1d5db !important;
            background: #f8fafc !important;
            font-size: 12px !important;
            font-weight: 700 !important;
            color: #111827 !important;
          }

          .print-detailed-card .print-detailed-body {
            padding: 10px !important;
            overflow: visible !important;
          }

          .print-detailed-sales-table {
            overflow: visible !important;
          }

          .print-detailed-sales-table table {
            page-break-inside: auto !important;
          }

          .print-detailed-sales-table tbody {
            display: table-row-group !important;
          }

          .print-detailed-sales-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <PrintOptionsModal
        open={showPrintOptions}
        options={printOptions}
        setOptions={setPrintOptions}
        onClose={() => setShowPrintOptions(false)}
        onConfirm={handlePrintConfirm}
      />

      <div className="sales-report-print-root">
        <div className="w-full max-w-none p-4 md:p-6 print-report-wrap">
          <div className="print-header hidden print:block">
            <div className="print-header-title">
              <div>
                <div className="brand">GUPTA AUTO AGENCY</div>
                <h1>Sales Analytics Report</h1>
                <div className="print-subtitle">
                  Compact print-ready report generated from Showroom DMS
                </div>
              </div>
              <div className="text-right print-subtitle">
                Generated: {generatedAt || new Date().toLocaleString("en-IN")}
              </div>
            </div>

            <div className="print-meta-grid">
              <div className="print-meta-item">
                <span className="k">Branch</span>
                <span className="v">{selectedBranchLabel}</span>
              </div>
              <div className="print-meta-item">
                <span className="k">From Date</span>
                <span className="v">{formatDateOnly(filters.fromDate)}</span>
              </div>
              <div className="print-meta-item">
                <span className="k">To Date</span>
                <span className="v">{formatDateOnly(filters.toDate)}</span>
              </div>
              <div className="print-meta-item">
                <span className="k">Search</span>
                <span className="v">{filters.search || "-"}</span>
              </div>
              <div className="print-meta-item">
                <span className="k">Detailed Print</span>
                <span className="v">{printOptions.detailedTable ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>

          <div className="screen-title flex flex-col gap-4 md:flex-row md:items-start md:justify-between no-print">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sales Report</h1>
              <p className="mt-1 text-sm text-slate-500">
                Detailed retail analytics by date, branch and model.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handlePrintOpen}
                className="inline-flex items-center rounded-xl bg-slate-800 text-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-700"
              >
                {printing ? "Preparing..." : "Print"}
              </button>
              <ExportButton url={exportUrl} />
            </div>
          </div>

          <div className="no-print rounded-xl border border-slate-300 bg-white shadow-sm p-4 mb-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {(["TODAY", "MTD", "YTD", "CUSTOM"] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {preset}
                </button>
              ))}
            </div>

            <ReportFilters
              values={filters}
              onChange={handleChange}
              onApply={handleApply}
              onReset={handleReset}
              branchOptions={activeBranches}
            />
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-300 bg-white shadow-sm p-6 text-center text-slate-500 loading-text">
              Loading sales report...
            </div>
          ) : null}

          <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 summary-grid-print ${!printOptions.summary ? "hide-section-in-print" : ""}`}>
            <StatCard
              label="Total Sales"
              value={summary.total_sales || 0}
              subtitle={`${formatDateOnly(filters.fromDate)} to ${formatDateOnly(filters.toDate)}`}
              accent="bg-blue-600"
            />
            <StatCard
              label="Total Amount"
              value={formatAmount(summary.total_amount)}
              subtitle="Retail value"
              accent="bg-emerald-600"
            />
            <StatCard
              label="Ex-Showroom"
              value={formatAmount(summary.total_ex_showroom)}
              subtitle="Vehicle amount"
              accent="bg-amber-500"
            />
            <StatCard
              label="Insurance + Accessories"
              value={formatAmount(
                Number(summary.total_insurance || 0) + Number(summary.total_accessories || 0)
              )}
              subtitle={`Insurance ${formatAmount(summary.total_insurance)} | Accessories ${formatAmount(summary.total_accessories)}`}
              accent="bg-violet-600"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-two-col mt-4">
            <div className={!printOptions.branchPie ? "hide-section-in-print" : ""}>
              <SectionCard title="Branch-wise Sales Share">
                <SimplePieChart
                  title="Sales count by branch"
                  rows={branchPieRows}
                  labelKey="branch_name"
                  valueKey="retail_count"
                />
              </SectionCard>
            </div>

            <div className={!printOptions.modelPie ? "hide-section-in-print" : ""}>
              <SectionCard title="Model-wise Sales Share">
                <SimplePieChart
                  title="Sales count by model"
                  rows={modelPieRows}
                  labelKey="vehicle_model"
                  valueKey="retail_count"
                />
              </SectionCard>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-two-col mt-4">
            <div className={!printOptions.dateChart ? "hide-section-in-print" : ""}>
              <SectionCard title="Date-wise Sales Trend">
                <HorizontalBars
                  title="Retail count by date"
                  rows={dateWise.map((r) => ({
                    label: `Day ${r.day_no}`,
                    value: r.retail_count,
                  }))}
                  labelKey="label"
                  valueKey="value"
                  colorClass="bg-blue-600"
                />
              </SectionCard>
            </div>

            <div className={!printOptions.monthChart ? "hide-section-in-print" : ""}>
              <SectionCard title="Month-wise Sales Trend" className="compact-month-chart">
                <HorizontalBars
                  title="Retail count by month"
                  rows={monthChartRows.map((r) => ({
                    label: r.month_label,
                    value: r.retail_count,
                  }))}
                  labelKey="label"
                  valueKey="value"
                  colorClass="bg-emerald-600"
                />
              </SectionCard>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-two-col mt-4">
            <div className={!printOptions.modelTable ? "hide-section-in-print" : ""}>
              <SectionCard title="Model-wise Summary" className="compact-table">
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="text-left px-3 py-2">Model</th>
                        <th className="text-right px-3 py-2">Retail</th>
                        <th className="text-right px-3 py-2">Amount</th>
                        <th className="text-right px-3 py-2">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelWise.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                            No model summary found
                          </td>
                        </tr>
                      ) : (
                        modelWise.map((row, index) => (
                          <tr key={index} className="border-t border-slate-200">
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {row.vehicle_model || "-"}
                            </td>
                            <td className="px-3 py-2 text-right">{row.retail_count || 0}</td>
                            <td className="px-3 py-2 text-right">{formatAmount(row.total_amount)}</td>
                            <td className="px-3 py-2 text-right">{formatAmount(row.avg_amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>

            <div className={!printOptions.monthTable ? "hide-section-in-print" : ""}>
              <SectionCard title="Month-wise Summary" className="compact-table">
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="text-left px-3 py-2">Month</th>
                        <th className="text-right px-3 py-2">Retail</th>
                        <th className="text-right px-3 py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthWise.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-8 text-center text-slate-500">
                            No month summary found
                          </td>
                        </tr>
                      ) : (
                        monthWise.map((row, index) => (
                          <tr key={index} className="border-t border-slate-200">
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {row.month_label || "-"}
                            </td>
                            <td className="px-3 py-2 text-right">{row.retail_count || 0}</td>
                            <td className="px-3 py-2 text-right">{formatAmount(row.total_amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </div>

          {/* SCREEN DETAILED TABLE */}
          <div
            className={`screen-detailed-wrapper ${
              !printOptions.detailedTable ? "hide-section-in-print" : ""
            }`}
          >
            <SectionCard title="Detailed Sales Table" className="screen-detailed-sales-table mt-4">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-3 py-2">ID</th>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Invoice</th>
                      <th className="text-left px-3 py-2">Customer</th>
                      <th className="text-left px-3 py-2">Mobile</th>
                      <th className="text-left px-3 py-2">Branch</th>
                      <th className="text-left px-3 py-2">Vehicle</th>
                      <th className="text-left px-3 py-2">Chassis</th>
                      <th className="text-left px-3 py-2">Engine</th>
                      <th className="text-right px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                          No detailed sales records found
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-3 py-2">{row.id}</td>
                          <td className="px-3 py-2">{row.sale_date ? String(row.sale_date).slice(0, 10) : "-"}</td>
                          <td className="px-3 py-2">{row.invoice_number || "-"}</td>
                          <td className="px-3 py-2">{row.customer_name || "-"}</td>
                          <td className="px-3 py-2">{row.mobile_number || "-"}</td>
                          <td className="px-3 py-2">{row.branch_name || "-"}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{row.vehicle_model || "-"}</td>
                          <td className="px-3 py-2">{row.chassis_number || "-"}</td>
                          <td className="px-3 py-2">{row.engine_number || "-"}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatAmount(row.sale_price)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {/* PRINT-ONLY DETAILED TABLE */}
          {printOptions.detailedTable ? (
            <div className="print-only print-detailed-wrapper">
              <div className="print-detailed-card">
                <div className="print-detailed-head">Detailed Sales Table</div>
                <div className="print-detailed-body">
                  <div className="print-detailed-sales-table">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left px-3 py-2">ID</th>
                          <th className="text-left px-3 py-2">Date</th>
                          <th className="text-left px-3 py-2">Invoice</th>
                          <th className="text-left px-3 py-2">Customer</th>
                          <th className="text-left px-3 py-2">Mobile</th>
                          <th className="text-left px-3 py-2">Branch</th>
                          <th className="text-left px-3 py-2">Vehicle</th>
                          <th className="text-left px-3 py-2 hide-in-print">Chassis</th>
                          <th className="text-left px-3 py-2 hide-in-print">Engine</th>
                          <th className="text-right px-3 py-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                              No detailed sales records found
                            </td>
                          </tr>
                        ) : (
                          rows.map((row) => (
                            <tr key={`print-${row.id}`} className="border-t border-slate-200">
                              <td className="px-3 py-2">{row.id}</td>
                              <td className="px-3 py-2">
                                {row.sale_date ? String(row.sale_date).slice(0, 10) : "-"}
                              </td>
                              <td className="px-3 py-2">{row.invoice_number || "-"}</td>
                              <td className="px-3 py-2">{row.customer_name || "-"}</td>
                              <td className="px-3 py-2">{row.mobile_number || "-"}</td>
                              <td className="px-3 py-2">{row.branch_name || "-"}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">
                                {row.vehicle_model || "-"}
                              </td>
                              <td className="px-3 py-2 hide-in-print">{row.chassis_number || "-"}</td>
                              <td className="px-3 py-2 hide-in-print">{row.engine_number || "-"}</td>
                              <td className="px-3 py-2 text-right font-semibold">
                                {formatAmount(row.sale_price)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}