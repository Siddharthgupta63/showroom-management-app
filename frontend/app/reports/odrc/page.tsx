"use client";

import { useEffect, useMemo, useState } from "react";
import ExportButton from "@/components/reports/ExportButton";

import { API_BASE } from "@/lib/apiBase";

type Branch = {
  id: number | string;
  name?: string;
  branch_name?: string;
};

type Summary = {
  opening_stock: number;
  dispatch_count: number;
  retail_count: number;
  closing_stock: number;
};

type BranchWiseRow = {
  branch_id: number;
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

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
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

function SimplePieChart({
  data,
  title,
}: {
  data: { label: string; value: number }[];
  title: string;
}) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);

  const colors = ["#2563eb", "#16a34a", "#dc2626", "#ca8a04", "#7c3aed", "#0891b2"];

  let start = 0;
  const slices = data.map((item, index) => {
    const value = Number(item.value || 0);
    const pct = total ? value / total : 0;
    const dash = pct * 100;
    const slice = {
      ...item,
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
            <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="#e5e7eb" strokeWidth="5" />
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
  title,
}: {
  data: { label: string; value: number }[];
  title: string;
}) {
  const max = Math.max(...data.map((d) => Number(d.value || 0)), 1);

  return (
    <div>
      <div className="font-semibold mb-3">{title}</div>
      <div className="space-y-3">
        {data.map((item, index) => {
          const width = `${(item.value / max) * 100}%`;
          return (
            <div key={index}>
              <div className="flex justify-between text-sm mb-1">
                <span>{item.label}</span>
                <span>{item.value}</span>
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

export default function OdrcReportPage() {
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [summary, setSummary] = useState<Summary>({
    opening_stock: 0,
    dispatch_count: 0,
    retail_count: 0,
    closing_stock: 0,
  });
  const [branchWise, setBranchWise] = useState<BranchWiseRow[]>([]);
  const [modelWise, setModelWise] = useState<ModelWiseRow[]>([]);
  const [filters, setFilters] = useState({
    reportDate: new Date().toISOString().slice(0, 10),
    branchId: "",
    search: "",
  });

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
        `${API_BASE}/api/reports/stock/odrc${queryString ? `?${queryString}` : ""}`,
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
        console.error("ODRC API error:", res.status, text);
        throw new Error(`ODRC failed: ${res.status}`);
      }

      const data = await res.json();

      setSummary(
        data?.summary || {
          opening_stock: 0,
          dispatch_count: 0,
          retail_count: 0,
          closing_stock: 0,
        }
      );
      setBranchWise(Array.isArray(data?.branchWise) ? data.branchWise : []);
      setModelWise(Array.isArray(data?.modelWise) ? data.modelWise : []);
    } catch (error) {
      console.error("Failed to load ODRC report", error);
      setBranchWise([]);
      setModelWise([]);
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

  const activeBranches = branches.map((b) => ({
    value: String(b.id),
    label: b.name || b.branch_name || `Branch ${b.id}`,
  }));

  const summaryPieData = [
    { label: "Opening", value: Number(summary.opening_stock || 0) },
    { label: "Dispatch", value: Number(summary.dispatch_count || 0) },
    { label: "Retail", value: Number(summary.retail_count || 0) },
    { label: "Closing", value: Number(summary.closing_stock || 0) },
  ];

  const topModelClosing = modelWise
    .slice()
    .sort((a, b) => Number(b.closing_stock) - Number(a.closing_stock))
    .slice(0, 8)
    .map((x) => ({
      label: x.model_label,
      value: Number(x.closing_stock || 0),
    }));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold">ODRC Report</h1>
          <p className="text-sm text-gray-600 mt-1">
            Opening Stock, Dispatch, Retail and Closing Stock for selected date.
          </p>
        </div>

        <div className="flex gap-2">
          <PrintButton />
          <ExportButton url={exportUrl} />
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm no-print">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Report Date</label>
            <input
              type="date"
              value={filters.reportDate}
              onChange={(e) => handleChange("reportDate", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Branch</label>
            <select
              value={filters.branchId}
              onChange={(e) => handleChange("branchId", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
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
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleChange("search", e.target.value)}
              placeholder="Model / Variant / Chassis / Engine / Customer / Mobile"
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleApply}
              className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Opening Stock" value={summary.opening_stock || 0} />
        <StatCard label="Dispatch" value={summary.dispatch_count || 0} />
        <StatCard label="Retail" value={summary.retail_count || 0} />
        <StatCard label="Closing Stock" value={summary.closing_stock || 0} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="ODRC Summary Pie Chart">
          <SimplePieChart data={summaryPieData} title="ODRC Split" />
        </SectionCard>

        <SectionCard title="Top Closing Stock Models">
          <SimpleBarChart data={topModelClosing} title="Closing Stock by Model" />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="Branch-wise ODRC">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
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
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                      {loading ? "Loading..." : "No branch records found"}
                    </td>
                  </tr>
                ) : (
                  branchWise.map((row, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-3 py-2">{row.branch_name}</td>
                      <td className="px-3 py-2 text-right">{row.opening_stock}</td>
                      <td className="px-3 py-2 text-right">{row.dispatch_count}</td>
                      <td className="px-3 py-2 text-right">{row.retail_count}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.closing_stock}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Model-wise ODRC">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
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
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                      {loading ? "Loading..." : "No model records found"}
                    </td>
                  </tr>
                ) : (
                  modelWise.map((row, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-3 py-2">{row.model_label}</td>
                      <td className="px-3 py-2 text-right">{row.opening_stock}</td>
                      <td className="px-3 py-2 text-right">{row.dispatch_count}</td>
                      <td className="px-3 py-2 text-right">{row.retail_count}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.closing_stock}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}