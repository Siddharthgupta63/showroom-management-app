"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/apiBase";

type Summary = {
  purchase_count: number;
  purchase_amount: number;
  sale_count: number;
  sale_amount: number;
};

type TrendRow = {
  date: string;
  purchase: number;
  sales: number;
};

type BranchRow = {
  branch: string;
  purchase: number;
  sales: number;
};

type ModelRow = {
  model: string;
  purchase: number;
  sales: number;
};

type Branch = {
  id: number | string;
  name?: string;
  branch_name?: string;
  is_active?: number | boolean;
};

type ApiResponse = {
  success?: boolean;
  summary?: Summary;
  trend?: TrendRow[];
  branchWise?: BranchRow[];
  modelWise?: ModelRow[];
  data?: {
    summary?: Summary;
    trend?: TrendRow[];
    branchWise?: BranchRow[];
    modelWise?: ModelRow[];
  };
};

type RangeType = "TODAY" | "MTD" | "YTD" | "CUSTOM";

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

function formatAmount(value?: number | string | null) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB");
}

function getDefaultDates(range: RangeType) {
  const today = new Date();
  const to = formatLocalDate(today);

  if (range === "TODAY") {
    return { from: to, to };
  }

  if (range === "MTD") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      from: formatLocalDate(first),
      to,
    };
  }

  if (range === "YTD") {
    const first = getFinancialYearStartLocal(today);
    return {
      from: formatLocalDate(first),
      to,
    };
  }

  return { from: to, to };
}

function StatCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </div>
          {subtitle ? (
            <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
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
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden ${className}`}
    >
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
      </div>
      <div className="p-5">{children}</div>
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

function ExportButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-emerald-500 no-print"
    >
      Export Excel
    </button>
  );
}

function MiniBarChart({
  data,
}: {
  data: TrendRow[];
}) {
  const max = Math.max(
    ...data.map((x) => Math.max(Number(x.purchase || 0), Number(x.sales || 0))),
    1
  );

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-56 rounded-xl bg-slate-50 text-slate-400">
        No trend data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((row, index) => {
        const purchaseWidth = `${(Number(row.purchase || 0) / max) * 100}%`;
        const salesWidth = `${(Number(row.sales || 0) / max) * 100}%`;

        return (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">
                {formatDateOnly(row.date)}
              </span>
              <span className="text-slate-500">
                P: {row.purchase || 0} | S: {row.sales || 0}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="w-16 text-xs text-slate-500">Purchase</div>
                <div className="h-3 flex-1 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-600"
                    style={{ width: purchaseWidth }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-16 text-xs text-slate-500">Sales</div>
                <div className="h-3 flex-1 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: salesWidth }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PurchaseVsSalesReport() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [range, setRange] = useState<RangeType>("MTD");
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    branchId: "",
    model: "",
    search: "",
  });

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString("en-IN"));
    const defaults = getDefaultDates("MTD");
    setFilters((prev) => ({
      ...prev,
      from: defaults.from,
      to: defaults.to,
    }));
  }, []);

  useEffect(() => {
    const defaults = getDefaultDates(range);
    if (range !== "CUSTOM") {
      setFilters((prev) => ({
        ...prev,
        from: defaults.from,
        to: defaults.to,
      }));
    }
  }, [range]);

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

  const payload = data?.data || data || {};
  const summary = payload?.summary || {
    purchase_count: 0,
    purchase_amount: 0,
    sale_count: 0,
    sale_amount: 0,
  };
  const trend: TrendRow[] = Array.isArray(payload?.trend) ? payload.trend : [];
  const branchWise: BranchRow[] = Array.isArray(payload?.branchWise)
    ? payload.branchWise
    : [];
  const modelWise: ModelRow[] = Array.isArray(payload?.modelWise)
    ? payload.modelWise
    : [];

  const sortedTrend = useMemo(() => {
    return [...trend].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [trend]);

  const topModels = useMemo(() => {
    return [...modelWise]
      .sort((a, b) => b.purchase + b.sales - (a.purchase + a.sales))
      .slice(0, 12);
  }, [modelWise]);

  const profit = Number(summary.sale_amount || 0) - Number(summary.purchase_amount || 0);
  const netUnits = Number(summary.sale_count || 0) - Number(summary.purchase_count || 0);

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
      const json = await res.json();

      if (Array.isArray(json)) setBranches(json);
      else if (Array.isArray(json?.rows)) setBranches(json.rows);
      else if (Array.isArray(json?.data)) setBranches(json.data);
      else setBranches([]);
    } catch (error) {
      console.error("Failed to load branches", error);
      setBranches([]);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.branchId) params.set("branchId", filters.branchId);
      if (filters.model) params.set("model", filters.model);

      const res = await fetch(
        `${API_BASE}/api/reports/purchase-vs-sales?${params.toString()}`,
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

      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("Failed to load purchase vs sales report", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (filters.from && filters.to) {
      fetchData();
    }
  }, [filters.from, filters.to]);

  const handleApply = () => {
    fetchData();
  };

  const handleReset = () => {
    const defaults = getDefaultDates("MTD");
    setRange("MTD");
    setFilters({
      from: defaults.from,
      to: defaults.to,
      branchId: "",
      model: "",
      search: "",
    });

    setTimeout(() => {
      window.location.href = "/reports/purchase-vs-sales";
    }, 0);
  };

  const exportCurrentView = () => {
    const rows: string[][] = [];

    rows.push(["Purchase vs Sales Report"]);
    rows.push(["Generated At", generatedAt || new Date().toLocaleString("en-IN")]);
    rows.push(["Range", range]);
    rows.push(["From", filters.from || "-"]);
    rows.push(["To", filters.to || "-"]);
    rows.push(["Branch", selectedBranchLabel]);
    rows.push(["Model Filter", filters.model || "-"]);
    rows.push([]);

    rows.push(["Summary"]);
    rows.push(["Purchases", String(summary.purchase_count || 0)]);
    rows.push(["Purchase Amount", String(summary.purchase_amount || 0)]);
    rows.push(["Sales", String(summary.sale_count || 0)]);
    rows.push(["Sales Amount", String(summary.sale_amount || 0)]);
    rows.push(["Profit", String(profit)]);
    rows.push(["Net Units", String(netUnits)]);
    rows.push([]);

    rows.push(["Branch Wise"]);
    rows.push(["Branch", "Purchase", "Sales"]);
    branchWise.forEach((r) =>
      rows.push([r.branch || "", String(r.purchase || 0), String(r.sales || 0)])
    );
    rows.push([]);

    rows.push(["Model Wise"]);
    rows.push(["Model", "Purchase", "Sales"]);
    modelWise.forEach((r) =>
      rows.push([r.model || "", String(r.purchase || 0), String(r.sales || 0)])
    );

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchase-vs-sales-${range.toLowerCase()}-${filters.from || "from"}-to-${
      filters.to || "to"
    }.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = async () => {
    setPrinting(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    window.print();
    setTimeout(() => setPrinting(false), 250);
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

          .purchase-sales-print-root,
          .purchase-sales-print-root * {
            visibility: visible;
          }

          .purchase-sales-print-root {
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
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 8px !important;
            margin-bottom: 8px !important;
          }

          .report-card {
            box-shadow: none !important;
            border: 1px solid #dbe3ee !important;
            border-radius: 10px !important;
            break-inside: avoid !important;
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

          .print-two-col {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }
        }
      `}</style>

      <div className="purchase-sales-print-root">
      <div className="w-full max-w-none p-4 md:p-6 space-y-4 print-report-wrap">
          <div className="print-header hidden print:block">
            <div className="brand">GUPTA AUTO AGENCY</div>
            <h1>Purchase vs Sales Report</h1>
            <div className="meta">
              <div className="meta-item">
                <span className="meta-k">Range</span>
                <span className="meta-v">{range}</span>
              </div>
              <div className="meta-item">
                <span className="meta-k">From</span>
                <span className="meta-v">{formatDateOnly(filters.from)}</span>
              </div>
              <div className="meta-item">
                <span className="meta-k">To</span>
                <span className="meta-v">{formatDateOnly(filters.to)}</span>
              </div>
              <div className="meta-item">
                <span className="meta-k">Branch</span>
                <span className="meta-v">{selectedBranchLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 no-print">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  Purchase vs Sales Report
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Compare stock inward and retail movement across time, branches and models.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <PrintButton onClick={handlePrint} printing={printing} />
                <ExportButton onClick={exportCurrentView} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["TODAY", "MTD", "YTD", "CUSTOM"] as RangeType[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                    range === r
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={filters.from}
                    onChange={(e) => {
                      setRange("CUSTOM");
                      setFilters((prev) => ({ ...prev, from: e.target.value }));
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={filters.to}
                    onChange={(e) => {
                      setRange("CUSTOM");
                      setFilters((prev) => ({ ...prev, to: e.target.value }));
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">
                    Branch
                  </label>
                  <select
                    value={filters.branchId}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, branchId: e.target.value }))
                    }
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
                    Model Filter
                  </label>
                  <input
                    type="text"
                    value={filters.model}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, model: e.target.value }))
                    }
                    placeholder="Model name"
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
              Loading purchase vs sales report...
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 summary-grid-print">
            <StatCard
              label="Purchases"
              value={summary.purchase_count || 0}
              subtitle={formatAmount(summary.purchase_amount)}
              accent="bg-cyan-600"
            />
            <StatCard
              label="Sales"
              value={summary.sale_count || 0}
              subtitle={formatAmount(summary.sale_amount)}
              accent="bg-blue-600"
            />
          
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-two-col">
            <SectionCard
              title="Trend View"
              subtitle="Date-wise purchase vs sales count"
            >
              <MiniBarChart data={sortedTrend} />
            </SectionCard>

            <SectionCard
              title="Snapshot"
              subtitle="Quick business view for current filter"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    Model Filter
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-800">
                    {filters.model || "-"}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    From
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-800">
                    {formatDateOnly(filters.from)}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    To
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-800">
                    {formatDateOnly(filters.to)}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-two-col">
            <SectionCard
              title="Branch Wise"
              subtitle="Purchase vs sales comparison by branch"
              className="compact-table"
            >
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left px-3 py-2">Branch</th>
                      <th className="text-right px-3 py-2">Purchase</th>
                      <th className="text-right px-3 py-2">Sales</th>
                      <th className="text-right px-3 py-2">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchWise.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                          No branch data found
                        </td>
                      </tr>
                    ) : (
                      branchWise.map((row, i) => (
                        <tr key={i} className="border-t border-slate-200">
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {row.branch || "-"}
                          </td>
                          <td className="px-3 py-2 text-right">{row.purchase || 0}</td>
                          <td className="px-3 py-2 text-right">{row.sales || 0}</td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {(row.sales || 0) - (row.purchase || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title="Model Wise"
              subtitle="Purchase vs sales comparison by model"
              className="compact-table"
            >
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left px-3 py-2">Model</th>
                      <th className="text-right px-3 py-2">Purchase</th>
                      <th className="text-right px-3 py-2">Sales</th>
                      <th className="text-right px-3 py-2">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topModels.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                          No model data found
                        </td>
                      </tr>
                    ) : (
                      topModels.map((row, i) => (
                        <tr key={i} className="border-t border-slate-200">
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {row.model || "-"}
                          </td>
                          <td className="px-3 py-2 text-right">{row.purchase || 0}</td>
                          <td className="px-3 py-2 text-right">{row.sales || 0}</td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {(row.sales || 0) - (row.purchase || 0)}
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