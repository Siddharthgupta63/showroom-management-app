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

function formatAmount(value: number | string | null | undefined) {
  const n = Number(value || 0);
  return `₹${n.toLocaleString("en-IN")}`;
}

function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex rounded-lg bg-slate-700 text-white px-4 py-2 text-sm font-medium no-print"
    >
      Print
    </button>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50 font-semibold">{title}</div>
      <div className="p-4">{children}</div>
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
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      {subValue !== undefined && (
        <div className="mt-1 text-sm text-gray-500">{subValue}</div>
      )}
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

  const slices = data.map((item, index) => {
    const value = Number(item[valueKey] || 0);
    const pct = total ? value / total : 0;
    const dash = pct * 100;
    const slice = {
      label: item[labelKey],
      value,
      color: colors[index % colors.length],
      start,
      dash,
    };
    start += dash;
    return slice;
  });

  return (
    <div>
      <div className="font-semibold mb-3">{title}</div>
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="relative w-48 h-48">
          <svg viewBox="0 0 42 42" className="w-48 h-48 -rotate-90">
            <circle
              cx="21"
              cy="21"
              r="15.9155"
              fill="transparent"
              stroke="#e5e7eb"
              strokeWidth="5"
            />
            {slices.map((slice, idx) => (
              <circle
                key={idx}
                cx="21"
                cy="21"
                r="15.9155"
                fill="transparent"
                stroke={slice.color}
                strokeWidth="5"
                strokeDasharray={`${slice.dash} ${100 - slice.dash}`}
                strokeDashoffset={-slice.start}
              />
            ))}
          </svg>
        </div>

        <div className="space-y-2 flex-1">
          {slices.map((slice, idx) => {
            const pct = total ? ((slice.value / total) * 100).toFixed(1) : "0.0";
            return (
              <div key={idx} className="flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span>{slice.label}</span>
                </div>
                <div className="text-gray-600">
                  {slice.value} ({pct}%)
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SimpleBarChart({
  data,
  labelKey,
  valueKey,
  title,
  valueFormatter,
}: {
  data: any[];
  labelKey: string;
  valueKey: string;
  title: string;
  valueFormatter?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey] || 0)), 1);

  return (
    <div>
      <div className="font-semibold mb-3">{title}</div>
      <div className="space-y-3">
        {data.map((item, index) => {
          const value = Number(item[valueKey] || 0);
          const width = `${(value / max) * 100}%`;
          return (
            <div key={index}>
              <div className="flex justify-between text-sm mb-1">
                <span>{item[labelKey]}</span>
                <span>{valueFormatter ? valueFormatter(value) : value}</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SalesReportPage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
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
  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    branchId: "",
    search: "",
  });

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

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setSummary(
        data?.summary || {
          total_sales: 0,
          total_amount: 0,
          total_ex_showroom: 0,
          total_insurance: 0,
          total_accessories: 0,
        }
      );
      setMtd(data?.mtd || { total_sales: 0, total_amount: 0 });
      setYtd(data?.ytd || { total_sales: 0, total_amount: 0 });
      setModelWise(Array.isArray(data?.modelWise) ? data.modelWise : []);
      setBranchWise(Array.isArray(data?.branchWise) ? data.branchWise : []);
      setDateWise(Array.isArray(data?.dateWise) ? data.dateWise : []);
      setMonthWise(Array.isArray(data?.monthWise) ? data.monthWise : []);
    } catch (error) {
      console.error("Failed to load sales analytics", error);
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
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (type === "today") {
      setFilters((prev) => ({
        ...prev,
        fromDate: todayStr,
        toDate: todayStr,
      }));
      return;
    }

    if (type === "mtd") {
      setFilters((prev) => ({
        ...prev,
        fromDate: `${yyyy}-${mm}-01`,
        toDate: todayStr,
      }));
      return;
    }

    const fyYear = today.getMonth() + 1 >= 4 ? yyyy : yyyy - 1;
    const fyStart = `${fyYear}-04-01`;

    if (type === "ytd" || type === "fy") {
      setFilters((prev) => ({
        ...prev,
        fromDate: fyStart,
        toDate: todayStr,
      }));
    }
  };

  const activeBranches = branches.map((b) => ({
    value: String(b.id),
    label: b.name || b.branch_name || `Branch ${b.id}`,
  }));

  const topModelWise = modelWise.slice(0, 8);
  const topBranchWise = branchWise.slice(0, 8);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body {
            background: white !important;
          }

          table {
            font-size: 12px !important;
          }

          .print-break {
            page-break-before: always;
          }
        }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold">Sales Analytics Report</h1>
          <p className="text-sm text-gray-600 mt-1">
            MTD, YTD, model-wise, date-wise, month-wise and chart analytics.
          </p>
        </div>

        <div className="flex gap-2">
          <PrintButton />
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
      </div>

      <div className="no-print">
        <ReportFilters
          values={filters}
          onChange={handleChange}
          onApply={handleApply}
          onReset={handleReset}
          branchOptions={activeBranches}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="Branch Share Pie Chart">
          <SimplePieChart
            data={topBranchWise}
            labelKey="branch_name"
            valueKey="retail_count"
            title="Branch-wise Retail Share"
          />
        </SectionCard>

        <SectionCard title="Model Share Pie Chart">
          <SimplePieChart
            data={topModelWise}
            labelKey="vehicle_model"
            valueKey="retail_count"
            title="Model-wise Retail Share"
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="Date-wise Retail Chart">
          <SimpleBarChart
            data={dateWise}
            labelKey="day_no"
            valueKey="retail_count"
            title="Date Number Wise Retail Count"
          />
        </SectionCard>

        <SectionCard title="Month-wise Retail Chart">
          <SimpleBarChart
            data={monthWise}
            labelKey="month_label"
            valueKey="retail_count"
            title="Month-wise Retail Count"
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-break">
        <SectionCard title="Model-wise Sales Table">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
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
                    <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                      No model-wise records found
                    </td>
                  </tr>
                ) : (
                  modelWise.map((row, index) => (
                    <tr key={index} className="border-t">
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

        <SectionCard title="Month-wise Sales Table">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-3 py-2">Month</th>
                  <th className="text-right px-3 py-2">Retail</th>
                  <th className="text-right px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {monthWise.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                      No month-wise records found
                    </td>
                  </tr>
                ) : (
                  monthWise.map((row, index) => (
                    <tr key={index} className="border-t">
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

      <SectionCard title="Detailed Sales Table">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 sticky top-0 z-10">
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
                <th className="text-right px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                    No records found
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">{row.id}</td>
                    <td className="px-3 py-2">
                      {row.sale_date ? String(row.sale_date).slice(0, 10) : ""}
                    </td>
                    <td className="px-3 py-2">{row.invoice_number || ""}</td>
                    <td className="px-3 py-2">{row.customer_name || ""}</td>
                    <td className="px-3 py-2">{row.mobile_number || ""}</td>
                    <td className="px-3 py-2">{row.branch_name || ""}</td>
                    <td className="px-3 py-2">{row.vehicle_model || ""}</td>
                    <td className="px-3 py-2">{row.chassis_number || ""}</td>
                    <td className="px-3 py-2">{row.engine_number || ""}</td>
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
  );
}