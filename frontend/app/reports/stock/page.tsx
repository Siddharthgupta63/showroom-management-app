"use client";

import { useEffect, useMemo, useState } from "react";
import ReportFilters from "@/components/reports/ReportFilters";
import ExportButton from "@/components/reports/ExportButton";
import { API_BASE } from "@/lib/apiBase";

type StockRow = {
  id: number;
  created_at: string;
  branch_name: string;
  vehicle_name: string;
  chassis_number: string;
  engine_number: string;
  status_code: string;
  customer_name: string;
  mobile_number: string;
  ageing_days: number;
};

type Summary = {
  total_stock: number;
  in_stock_count: number;
  sold_count: number;
  ageing_0_30: number;
  ageing_31_60: number;
  ageing_61_90: number;
  ageing_90_plus: number;
};

type Branch = {
  id: number | string;
  name?: string;
  branch_name?: string;
  is_active?: number | boolean;
};

function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-GB");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-GB");
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

function AgeBar({
  label,
  value,
  max,
  colorClass,
}: {
  label: string;
  value: number;
  max: number;
  colorClass: string;
}) {
  const width = max > 0 ? `${Math.max(6, (value / max) * 100)}%` : "0%";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{value}</span>
      </div>
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width }} />
      </div>
    </div>
  );
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
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden report-card ${className}`}>
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
        <div className="text-lg font-semibold text-slate-900 section-title">{title}</div>
        {subtitle ? (
          <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
        ) : null}
      </div>
      <div className="p-5 section-body">{children}</div>
    </div>
  );
}

export default function StockReportPage() {
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showDetailed, setShowDetailed] = useState(true);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [summary, setSummary] = useState<Summary>({
    total_stock: 0,
    in_stock_count: 0,
    sold_count: 0,
    ageing_0_30: 0,
    ageing_31_60: 0,
    ageing_61_90: 0,
    ageing_90_plus: 0,
  });

  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    branchId: "",
    status: "",
    search: "",
  });

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString("en-IN"));
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.fromDate) params.set("fromDate", filters.fromDate);
    if (filters.toDate) params.set("toDate", filters.toDate);
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.status) params.set("status", filters.status);
    if (filters.search) params.set("search", filters.search);
    return params.toString();
  }, [filters]);

  const exportUrl = useMemo(() => {
    return `${API_BASE}/api/reports/stock/export${queryString ? `?${queryString}` : ""}`;
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

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Stock",
        value: summary.total_stock || 0,
        accent: "bg-blue-600",
        subtitle: "All rows in current filter",
      },
      {
        label: "In Stock",
        value: summary.in_stock_count || 0,
        accent: "bg-amber-500",
        subtitle: "Vehicles currently available",
      },
      {
        label: "Sold",
        value: summary.sold_count || 0,
        accent: "bg-emerald-600",
        subtitle: "Vehicles already sold",
      },
      {
        label: "0-30 Days",
        value: summary.ageing_0_30 || 0,
        accent: "bg-cyan-600",
      },
      {
        label: "31-60 Days",
        value: summary.ageing_31_60 || 0,
        accent: "bg-violet-600",
      },
      {
        label: "61-90 Days",
        value: summary.ageing_61_90 || 0,
        accent: "bg-orange-600",
      },
      {
        label: "90+ Days",
        value: summary.ageing_90_plus || 0,
        accent: "bg-rose-600",
      },
    ],
    [summary]
  );

  const ageingMax = Math.max(
    summary.ageing_0_30 || 0,
    summary.ageing_31_60 || 0,
    summary.ageing_61_90 || 0,
    summary.ageing_90_plus || 0,
    1
  );

  const stockMixMax = Math.max(summary.in_stock_count || 0, summary.sold_count || 0, 1);

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

      if (Array.isArray(data)) {
        setBranches(data);
      } else if (Array.isArray(data?.rows)) {
        setBranches(data.rows);
      } else if (Array.isArray(data?.data)) {
        setBranches(data.data);
      } else {
        setBranches([]);
      }
    } catch (error) {
      console.error("Failed to load branches", error);
      setBranches([]);
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/api/reports/stock${queryString ? `?${queryString}` : ""}`,
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
        console.error("Stock report API error:", res.status, text);
        throw new Error(`Stock report failed: ${res.status}`);
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
            total_stock: 0,
            in_stock_count: 0,
            sold_count: 0,
            ageing_0_30: 0,
            ageing_31_60: 0,
            ageing_61_90: 0,
            ageing_90_plus: 0,
          }
      );
    } catch (error) {
      console.error("Failed to load stock report", error);
      setRows([]);
      setSummary({
        total_stock: 0,
        in_stock_count: 0,
        sold_count: 0,
        ageing_0_30: 0,
        ageing_31_60: 0,
        ageing_61_90: 0,
        ageing_90_plus: 0,
      });
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
      status: "",
      search: "",
    });

    setTimeout(() => {
      window.location.href = "/reports/stock";
    }, 0);
  };

  const handlePrint = async () => {
    const includeDetailed = window.confirm(
      "Include Detailed Stock Table in print?"
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

          .stock-report-print-root,
          .stock-report-print-root * {
            visibility: visible;
          }

          .stock-report-print-root {
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

          .print-two-col {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }

          .detailed-stock-table table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8.2px !important;
          }

          .detailed-stock-table thead {
            display: table-header-group !important;
          }

          .detailed-stock-table th,
          .detailed-stock-table td {
            border: 1px solid #dbe3ee !important;
            padding: 4px 5px !important;
            line-height: 1.15 !important;
            vertical-align: top !important;
            word-break: break-word !important;
          }

          .detailed-stock-table th {
            background: #f8fafc !important;
            font-weight: 700 !important;
          }

          .detailed-stock-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .hide-in-print {
            display: none !important;
          }

          .print-page-break {
            page-break-before: always !important;
            break-before: page !important;
          }
        }
      `}</style>

      <div className="stock-report-print-root">
        <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-4 print-report-wrap">
          <div className="print-header hidden print:block">
            <div className="brand">GUPTA AUTO AGENCY</div>
            <h1>Stock Report</h1>
            <div className="meta">
              <div className="meta-item">
                <span className="meta-k">Branch</span>
                <span className="meta-v">{selectedBranchLabel}</span>
              </div>
              <div className="meta-item">
                <span className="meta-k">From Date</span>
                <span className="meta-v">{formatDateOnly(filters.fromDate)}</span>
              </div>
              <div className="meta-item">
                <span className="meta-k">To Date</span>
                <span className="meta-v">{formatDateOnly(filters.toDate)}</span>
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
                  Stock Report
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  View current stock, sold stock and ageing summary.
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

            <ReportFilters
              values={filters}
              onChange={handleChange}
              onApply={handleApply}
              onReset={handleReset}
              branchOptions={activeBranches}
              showStatus
              statusOptions={[
                { value: "in_stock", label: "In Stock" },
                { value: "sold", label: "Sold" },
              ]}
            />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-500 shadow-sm">
              Loading stock report...
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 summary-grid-print">
            {summaryCards.map((card) => (
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
              title="Stock Mix"
              subtitle="Current distribution of in-stock and sold vehicles"
              className="xl:col-span-1"
            >
              <div className="space-y-5">
                <AgeBar
                  label="In Stock"
                  value={summary.in_stock_count || 0}
                  max={stockMixMax}
                  colorClass="bg-amber-500"
                />
                <AgeBar
                  label="Sold"
                  value={summary.sold_count || 0}
                  max={stockMixMax}
                  colorClass="bg-emerald-600"
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Ageing Buckets"
              subtitle="Vehicle ageing summary for current filters"
              className="xl:col-span-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <AgeBar
                  label="0-30 Days"
                  value={summary.ageing_0_30 || 0}
                  max={ageingMax}
                  colorClass="bg-cyan-600"
                />
                <AgeBar
                  label="31-60 Days"
                  value={summary.ageing_31_60 || 0}
                  max={ageingMax}
                  colorClass="bg-violet-600"
                />
                <AgeBar
                  label="61-90 Days"
                  value={summary.ageing_61_90 || 0}
                  max={ageingMax}
                  colorClass="bg-orange-600"
                />
                <AgeBar
                  label="90+ Days"
                  value={summary.ageing_90_plus || 0}
                  max={ageingMax}
                  colorClass="bg-rose-600"
                />
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Stock Summary"
            subtitle="Quick operational view for filtered stock"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Current Filter
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  Branch: <span className="font-semibold">{selectedBranchLabel}</span>
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  Status:{" "}
                  <span className="font-semibold">
                    {filters.status ? statusLabel(filters.status) : "All"}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date Window
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  From: <span className="font-semibold">{formatDateOnly(filters.fromDate)}</span>
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  To: <span className="font-semibold">{formatDateOnly(filters.toDate)}</span>
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

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Generated
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-800">
                  {generatedAt || new Date().toLocaleString("en-IN")}
                </div>
              </div>
            </div>
          </SectionCard>

          {showDetailed ? (
            <SectionCard
              title="Detailed Stock Table"
              subtitle="Vehicle-level stock records"
              className="detailed-stock-table print-page-break"
            >
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-3 py-2">ID</th>
                      <th className="text-left px-3 py-2">Purchase Date</th>
                      <th className="text-left px-3 py-2">Branch</th>
                      <th className="text-left px-3 py-2">Vehicle</th>
                      <th className="text-left px-3 py-2">Chassis</th>
                      <th className="text-left px-3 py-2">Engine</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-left px-3 py-2">Customer</th>
                      <th className="text-left px-3 py-2">Mobile</th>
                      <th className="text-right px-3 py-2">Ageing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                          No stock rows found for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-3 py-2">{row.id}</td>
                          <td className="px-3 py-2">{formatDateOnly(row.created_at)}</td>
                          <td className="px-3 py-2">{row.branch_name || "-"}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {row.vehicle_name || "-"}
                          </td>
                          <td className="px-3 py-2">{row.chassis_number || "-"}</td>
                          <td className="px-3 py-2">{row.engine_number || "-"}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses(
                                row.status_code
                              )}`}
                            >
                              {statusLabel(row.status_code)}
                            </span>
                          </td>
                          <td className="px-3 py-2">{row.customer_name || "-"}</td>
                          <td className="px-3 py-2">{row.mobile_number || "-"}</td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {Number(row.ageing_days || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : null}

          {!showDetailed ? (
            <div className="no-print rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
              Detailed stock table is hidden.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}