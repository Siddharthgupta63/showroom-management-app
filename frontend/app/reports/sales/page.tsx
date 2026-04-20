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

type CountAmount = {
  total_sales: number;
  total_amount: number;
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
  return new Date(year, 3, 1); // 1 April
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
    <div
      className={`rounded-xl border border-slate-300 bg-white shadow-sm overflow-hidden report-card ${className}`}
    >
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
  subValue,
}: {
  label: string;
  value: string | number;
  subValue?: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm stat-card min-h-[124px] flex flex-col justify-between">
      <div className="text-[15px] text-slate-500 leading-snug stat-label">{label}</div>
      <div className="mt-2 stat-value-wrap">
        <div className="text-[18px] md:text-[21px] xl:text-[22px] font-bold text-slate-900 leading-tight break-words stat-value">
          {value}
        </div>
        {subValue !== undefined && (
          <div className="mt-1 text-sm text-slate-500 stat-subvalue">{subValue}</div>
        )}
      </div>
    </div>
  );
}

function SimplePieChart({
  data,
  labelKey,
  valueKey,
  title,
}: {
  data: any[];
  labelKey: string;
  valueKey: string;
  title: string;
}) {
  const total = data.reduce((sum, item) => sum + Number(item[valueKey] || 0), 0);

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

  const segments = data.map((item, index) => {
    const value = Number(item[valueKey] || 0);
    const percent = total > 0 ? (value / total) * 100 : 0;
    const end = start + percent;

    const segment = {
      ...item,
      value,
      percent,
      color: colors[index % colors.length],
      start,
      end,
    };

    start = end;
    return segment;
  });

  const makeArc = (startPercent: number, endPercent: number) => {
    const startAngle = (startPercent / 100) * 360 - 90;
    const endAngle = (endPercent / 100) * 360 - 90;

    const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
      const rad = (angle * Math.PI) / 180;
      return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad),
      };
    };

    const startOuter = polarToCartesian(50, 50, 40, startAngle);
    const endOuter = polarToCartesian(50, 50, 40, endAngle);
    const startInner = polarToCartesian(50, 50, 22, endAngle);
    const endInner = polarToCartesian(50, 50, 22, startAngle);
    const largeArc = endPercent - startPercent > 50 ? 1 : 0;

    return `
      M ${startOuter.x} ${startOuter.y}
      A 40 40 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}
      L ${startInner.x} ${startInner.y}
      A 22 22 0 ${largeArc} 0 ${endInner.x} ${endInner.y}
      Z
    `;
  };

  return (
    <div className="space-y-4 chart-block">
      <div className="text-sm font-medium text-slate-700">{title}</div>

      {segments.length === 0 || total === 0 ? (
        <div className="flex items-center justify-center h-56 rounded-lg bg-slate-50 text-slate-400">
          No data available
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-center chart-wrap">
          <div className="w-full flex justify-center">
            <svg
              viewBox="0 0 100 100"
              className="w-44 h-44 print-chart-svg"
              aria-label={title}
            >
              {segments.map((segment, index) => (
                <path
                  key={index}
                  d={makeArc(segment.start, segment.end)}
                  fill={segment.color}
                />
              ))}
              <circle cx="50" cy="50" r="16" fill="white" />
            </svg>
          </div>

          <div className="space-y-2">
            {segments.map((segment, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="truncate">
                    {segment[labelKey] || "Unknown"}
                  </span>
                </div>
                <span className="text-slate-600 shrink-0">
                  {segment.value} ({segment.percent.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SimpleBarChart({
  data,
  labelKey,
  valueKey,
  title,
  compact = false,
}: {
  data: any[];
  labelKey: string;
  valueKey: string;
  title: string;
  compact?: boolean;
}) {
  const max = Math.max(...data.map((item) => Number(item[valueKey] || 0)), 0);

  const wrapperClass = compact ? "space-y-4 max-w-[520px]" : "space-y-3";

  return (
    <div className="space-y-4 chart-block">
      <div className="text-sm font-medium text-slate-700">{title}</div>

      {data.length === 0 || max === 0 ? (
        <div className="flex items-center justify-center h-56 rounded-lg bg-slate-50 text-slate-400">
          No data available
        </div>
      ) : (
        <div className={wrapperClass}>
          {data.map((item, index) => {
            const value = Number(item[valueKey] || 0);
            const width = max > 0 ? `${(value / max) * 100}%` : "0%";

            return (
              <div key={index} className="grid grid-cols-[56px_1fr_56px] gap-3 items-center">
                <div className="text-sm text-slate-600 text-right">
                  {String(item[labelKey] ?? "")}
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width }}
                  />
                </div>
                <div className="text-sm font-medium text-slate-700">{value}</div>
              </div>
            );
          })}
        </div>
      )}
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

  const OptionRow = ({
    label,
    field,
  }: {
    label: string;
    field: keyof PrintOptions;
  }) => (
    <label className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2 cursor-pointer">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={options[field]}
        onChange={() => toggle(field)}
        className="h-4 w-4"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4 no-print">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border">
        <div className="px-5 py-4 border-b">
          <h3 className="text-lg font-bold text-slate-900">Print Options</h3>
          <p className="text-sm text-slate-500 mt-1">
            Select which sections you want in the PDF / print.
          </p>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <OptionRow label="Summary Cards" field="summary" />
          <OptionRow label="Branch Share Pie Chart" field="branchPie" />
          <OptionRow label="Model Share Pie Chart" field="modelPie" />
          <OptionRow label="Date-wise Retail Chart" field="dateChart" />
          <OptionRow label="Month-wise Retail Chart" field="monthChart" />
          <OptionRow label="Model-wise Sales Table" field="modelTable" />
          <OptionRow label="Month-wise Sales Table" field="monthTable" />
          <OptionRow label="Detailed Sales Table" field="detailedTable" />
        </div>

        <div className="px-5 py-4 border-t flex justify-between gap-2 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() =>
                setOptions({
                  summary: true,
                  branchPie: true,
                  modelPie: true,
                  dateChart: true,
                  monthChart: true,
                  modelTable: true,
                  monthTable: true,
                  detailedTable: false,
                })
              }
              className="rounded-lg border px-3 py-2 text-sm font-medium"
            >
              Default
            </button>

            <button
              onClick={() =>
                setOptions({
                  summary: true,
                  branchPie: true,
                  modelPie: true,
                  dateChart: true,
                  monthChart: true,
                  modelTable: true,
                  monthTable: true,
                  detailedTable: true,
                })
              }
              className="rounded-lg border px-3 py-2 text-sm font-medium"
            >
              All
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="rounded-lg bg-slate-800 text-white px-4 py-2 text-sm font-medium"
            >
              Print Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SalesAnalyticsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total_sales: 0,
    total_amount: 0,
    total_ex_showroom: 0,
    total_insurance: 0,
    total_accessories: 0,
  });
  const [mtd, setMtd] = useState<CountAmount>({
    total_sales: 0,
    total_amount: 0,
  });
  const [ytd, setYtd] = useState<CountAmount>({
    total_sales: 0,
    total_amount: 0,
  });
  const [modelWise, setModelWise] = useState<ModelWiseRow[]>([]);
  const [branchWise, setBranchWise] = useState<BranchWiseRow[]>([]);
  const [dateWise, setDateWise] = useState<DateWiseRow[]>([]);
  const [monthWise, setMonthWise] = useState<MonthWiseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [showDetailedTable, setShowDetailedTable] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    fromDate: "",
    toDate: "",
    branchId: "",
    search: "",
  });

  const [printOptions, setPrintOptions] = useState<PrintOptions>({
    summary: true,
    branchPie: true,
    modelPie: true,
    dateChart: true,
    monthChart: true,
    modelTable: true,
    monthTable: true,
    detailedTable: false,
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
    return `${API_BASE}/api/reports/sales/export${queryString ? `?${queryString}` : ""}`;
  }, [queryString]);

  const activeBranches = useMemo(
    () =>
      branches
        .filter((b) => b.is_active !== 0)
        .map((b) => ({
          value: String(b.id),
          label: b.branch_name || b.name || "Unknown",
        })),
    [branches]
  );

  const selectedBranchLabel = useMemo(() => {
    const found = activeBranches.find((b) => b.value === filters.branchId);
    return found?.label || "All Branches";
  }, [activeBranches, filters.branchId]);

  const topModelWise = useMemo(() => modelWise.slice(0, 8), [modelWise]);
  const topBranchWise = useMemo(() => branchWise.slice(0, 8), [branchWise]);

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
        console.error("Sales analytics API error:", res.status, text);
        throw new Error(`Sales analytics failed: ${res.status}`);
      }

      const data = await res.json();
      const payload = data?.data || data || {};

      setRows(
        Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(data?.rows)
          ? data.rows
          : []
      );

      setSummary(
        payload?.summary ||
          data?.summary || {
            total_sales: 0,
            total_amount: 0,
            total_ex_showroom: 0,
            total_insurance: 0,
            total_accessories: 0,
          }
      );

      setMtd(payload?.mtd || data?.mtd || { total_sales: 0, total_amount: 0 });
      setYtd(payload?.ytd || data?.ytd || { total_sales: 0, total_amount: 0 });

      setModelWise(
        Array.isArray(payload?.modelWise)
          ? payload.modelWise
          : Array.isArray(data?.modelWise)
          ? data.modelWise
          : []
      );

      setBranchWise(
        Array.isArray(payload?.branchWise)
          ? payload.branchWise
          : Array.isArray(data?.branchWise)
          ? data.branchWise
          : []
      );

      setDateWise(
        Array.isArray(payload?.dateWise)
          ? payload.dateWise
          : Array.isArray(data?.dateWise)
          ? data.dateWise
          : []
      );

      setMonthWise(
        Array.isArray(payload?.monthWise)
          ? payload.monthWise
          : Array.isArray(data?.monthWise)
          ? data.monthWise
          : []
      );
    } catch (error) {
      console.error("Failed to load sales analytics", error);
      setRows([]);
      setSummary({
        total_sales: 0,
        total_amount: 0,
        total_ex_showroom: 0,
        total_insurance: 0,
        total_accessories: 0,
      });
      setMtd({ total_sales: 0, total_amount: 0 });
      setYtd({ total_sales: 0, total_amount: 0 });
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
    setFilters({
      fromDate: "",
      toDate: "",
      branchId: "",
      search: "",
    });

    setTimeout(() => {
      window.location.href = "/reports/sales";
    }, 0);
  };

 const setQuickRange = (type: "today" | "mtd" | "ytd" | "fy") => {
  const today = new Date();
  const todayStr = formatLocalDate(today);

  if (type === "today") {
    setFilters((prev) => ({
      ...prev,
      fromDate: todayStr,
      toDate: todayStr,
    }));
    return;
  }

  if (type === "mtd") {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    setFilters((prev) => ({
      ...prev,
      fromDate: formatLocalDate(monthStart),
      toDate: todayStr,
    }));
    return;
  }

  const fyStart = getFinancialYearStartLocal(today);

  setFilters((prev) => ({
    ...prev,
    fromDate: formatLocalDate(fyStart),
    toDate: todayStr,
  }));
};
  const handlePrintConfirm = async () => {
    setShowPrintOptions(false);
    await new Promise((resolve) => setTimeout(resolve, 350));
    window.print();
  };

  const printHide = (enabled: boolean) => (!enabled ? "print-hide-section" : "");

  return (
    <div className="min-h-screen bg-slate-50">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 9mm;
          }

          html,
          body {
            background: #ffffff !important;
            color: #111827 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-size: 11px !important;
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
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          .no-print,
          aside,
          nav {
            display: none !important;
          }

          .print-hide-section {
            display: none !important;
          }

          .print-report-wrap {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }

          .print-header {
            display: block !important;
            margin-bottom: 8px !important;
            border: 1px solid #d1d5db !important;
            border-left: 5px solid #dc2626 !important;
            border-radius: 10px !important;
            padding: 10px 12px !important;
            break-inside: avoid !important;
          }

          .print-header-title {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            gap: 12px !important;
            margin-bottom: 8px !important;
          }

          .print-header-title h1 {
            font-size: 20px !important;
            line-height: 1.1 !important;
            margin: 0 !important;
            font-weight: 800 !important;
            color: #111827 !important;
          }

          .print-header-title .brand {
            font-size: 12px !important;
            font-weight: 700 !important;
            color: #dc2626 !important;
            margin-bottom: 2px !important;
          }

          .print-subtitle {
            font-size: 10px !important;
            color: #4b5563 !important;
          }

          .print-meta-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 6px !important;
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
            color: #111827 !important;
            font-weight: 600 !important;
          }

          .summary-grid-print {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 8px !important;
            margin-bottom: 8px !important;
            break-inside: avoid !important;
          }

          .stat-card {
            border: 1px solid #d1d5db !important;
            box-shadow: none !important;
            border-radius: 10px !important;
            padding: 8px 10px !important;
            min-height: 92px !important;
            break-inside: avoid !important;
          }

          .stat-label {
            font-size: 9px !important;
            line-height: 1.2 !important;
            color: #6b7280 !important;
          }

          .stat-value {
            font-size: 19px !important;
            line-height: 1.08 !important;
            margin-top: 4px !important;
            word-break: break-word !important;
          }

          .stat-subvalue {
            font-size: 9px !important;
            margin-top: 2px !important;
          }

          .print-chart-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            margin-bottom: 8px !important;
            align-items: start !important;
            break-inside: avoid !important;
          }

          .report-card {
            border: 1px solid #d1d5db !important;
            box-shadow: none !important;
            border-radius: 10px !important;
            break-inside: avoid !important;
          }

          .section-title {
            padding: 8px 10px !important;
            font-size: 12px !important;
            background: #f9fafb !important;
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

          .print-page-break {
            page-break-before: always !important;
            break-before: page !important;
          }

          .compact-table table,
          .detailed-sales-table table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          .compact-table thead,
          .detailed-sales-table thead {
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

          .detailed-sales-table th,
          .detailed-sales-table td {
            border: 1px solid #d1d5db !important;
            padding: 3px 5px !important;
            font-size: 8px !important;
            line-height: 1.15 !important;
            vertical-align: top !important;
            word-break: break-word !important;
          }

          .compact-table th,
          .detailed-sales-table th {
            background: #f3f4f6 !important;
            font-weight: 700 !important;
          }

          .compact-table tr,
          .detailed-sales-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .detailed-sales-table .hide-in-print {
            display: none !important;
          }

          .screen-title {
            margin-bottom: 14px !important;
          }

          .loading-text {
            display: none !important;
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
          <div className="print-header hidden">
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
            </div>
          </div>

          <div className="flex flex-col gap-4 screen-title">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  Sales Analytics Report
                </h1>
                <p className="text-slate-600 mt-1">
                  MTD, YTD, model-wise, date-wise, month-wise and chart analytics.
                </p>
              </div>

              <div className="flex gap-2 flex-wrap no-print">
                <button
                  onClick={() => setShowPrintOptions(true)}
                  className="inline-flex rounded-lg bg-slate-700 text-white px-4 py-2 text-sm font-medium"
                >
                  Print
                </button>
                <ExportButton url={exportUrl} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 no-print">
              <button
                onClick={() => setQuickRange("today")}
                className="rounded-lg border px-3 py-2 text-sm font-medium bg-white"
              >
                Today
              </button>
              <button
                onClick={() => setQuickRange("mtd")}
                className="rounded-lg border px-3 py-2 text-sm font-medium bg-white"
              >
                MTD
              </button>
              <button
                onClick={() => setQuickRange("ytd")}
                className="rounded-lg border px-3 py-2 text-sm font-medium bg-white"
              >
                YTD
              </button>
              <button
                onClick={() => setQuickRange("fy")}
                className="rounded-lg border px-3 py-2 text-sm font-medium bg-white"
              >
                This FY
              </button>
              <button
                onClick={handleApply}
                className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium"
              >
                Refresh
              </button>

              <button
                onClick={() => setShowDetailedTable((prev) => !prev)}
                className="rounded-lg border px-4 py-2 text-sm font-medium bg-white"
              >
                {showDetailedTable ? "Hide Detailed Table" : "Show Detailed Table"}
              </button>
            </div>

            <div className="no-print report-filters-wrap">
              <ReportFilters
                values={filters}
                onChange={handleChange}
                onApply={handleApply}
                onReset={handleReset}
                branchOptions={activeBranches}
              />
            </div>
          </div>

          {loading && (
            <div className="loading-text text-sm text-slate-500 mb-3">
              Loading report...
            </div>
          )}

          <div className={`${printHide(printOptions.summary)}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 summary-grid-print items-stretch">
              <StatCard label="Filtered Sales" value={summary.total_sales || 0} />
              <StatCard
                label="Filtered Amount"
                value={formatAmount(summary.total_amount)}
              />
              <StatCard
                label="MTD Sales"
                value={mtd.total_sales || 0}
                subValue={formatAmount(mtd.total_amount)}
              />
              <StatCard
                label="YTD Sales"
                value={ytd.total_sales || 0}
                subValue={formatAmount(ytd.total_amount)}
              />
              <StatCard
                label="Ex Showroom"
                value={formatAmount(summary.total_ex_showroom)}
              />
              <StatCard
                label="Accessories + Insurance"
                value={formatAmount(
                  Number(summary.total_insurance || 0) +
                    Number(summary.total_accessories || 0)
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-chart-grid items-start">
            <div className={printHide(printOptions.branchPie)}>
              <SectionCard title="Branch Share Pie Chart">
                <SimplePieChart
                  data={topBranchWise}
                  labelKey="branch_name"
                  valueKey="retail_count"
                  title="Branch-wise Retail Share"
                />
              </SectionCard>
            </div>

            <div className={printHide(printOptions.modelPie)}>
              <SectionCard title="Model Share Pie Chart">
                <SimplePieChart
                  data={topModelWise}
                  labelKey="vehicle_model"
                  valueKey="retail_count"
                  title="Model-wise Retail Share"
                />
              </SectionCard>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-chart-grid items-start">
            <div className={printHide(printOptions.dateChart)}>
              <SectionCard title="Date-wise Retail Chart">
                <SimpleBarChart
                  data={dateWise}
                  labelKey="day_no"
                  valueKey="retail_count"
                  title="Date Number Wise Retail Count"
                />
              </SectionCard>
            </div>

            <div className={printHide(printOptions.monthChart)}>
              <SectionCard title="Month-wise Retail Chart" className="compact-month-chart">
                <SimpleBarChart
                  data={monthWise}
                  labelKey="month_label"
                  valueKey="retail_count"
                  title="Month-wise Retail Count"
                  compact
                />
              </SectionCard>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-page-break items-start">
            <div className={printHide(printOptions.modelTable)}>
              <SectionCard title="Model-wise Sales Table" className="compact-table">
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
                          <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                            No model-wise records found
                          </td>
                        </tr>
                      ) : (
                        modelWise.map((row, index) => (
                          <tr key={index} className="border-t border-slate-200">
                            <td className="px-3 py-2">{row.vehicle_model || "Unknown"}</td>
                            <td className="px-3 py-2 text-right">{row.retail_count}</td>
                            <td className="px-3 py-2 text-right">
                              {formatAmount(row.total_amount)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatAmount(row.avg_amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>

            <div className={printHide(printOptions.monthTable)}>
              <SectionCard title="Month-wise Sales Table" className="compact-table">
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
                          <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                            No month-wise records found
                          </td>
                        </tr>
                      ) : (
                        monthWise.map((row, index) => (
                          <tr key={index} className="border-t border-slate-200">
                            <td className="px-3 py-2">{row.month_label}</td>
                            <td className="px-3 py-2 text-right">{row.retail_count}</td>
                            <td className="px-3 py-2 text-right">
                              {formatAmount(row.total_amount)}
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

          {(showDetailedTable || printOptions.detailedTable) && (
            <div className={printHide(printOptions.detailedTable)}>
              <SectionCard title="Detailed Sales Table" className="detailed-sales-table mt-4">
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
                          <tr key={row.id} className="border-t border-slate-200">
                            <td className="px-3 py-2">{row.id}</td>
                            <td className="px-3 py-2">
                              {row.sale_date ? String(row.sale_date).slice(0, 10) : "-"}
                            </td>
                            <td className="px-3 py-2">{row.invoice_number || "-"}</td>
                            <td className="px-3 py-2">{row.customer_name || "-"}</td>
                            <td className="px-3 py-2">{row.mobile_number || "-"}</td>
                            <td className="px-3 py-2">{row.branch_name || "-"}</td>
                            <td className="px-3 py-2">{row.vehicle_model || "-"}</td>
                            <td className="px-3 py-2 hide-in-print">
                              {row.chassis_number || "-"}
                            </td>
                            <td className="px-3 py-2 hide-in-print">
                              {row.engine_number || "-"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatAmount(row.sale_price)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}