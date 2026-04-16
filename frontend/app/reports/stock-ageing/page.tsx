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
  className = "",
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${className}`}>
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
  const colors = ["#16a34a", "#2563eb", "#ca8a04", "#ea580c", "#dc2626", "#7c3aed"];

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

function bucketBadgeClass(bucket: string) {
  if (bucket === "90+ Days") return "bg-red-100 text-red-700";
  if (bucket === "61-90 Days") return "bg-orange-100 text-orange-700";
  if (bucket === "31-60 Days") return "bg-yellow-100 text-yellow-700";
  if (bucket === "16-30 Days") return "bg-blue-100 text-blue-700";
  return "bg-green-100 text-green-700";
}

function rowAlertClass(days: number) {
  if (days > 90) return "bg-red-50";
  if (days > 60) return "bg-orange-50";
  if (days > 30) return "bg-yellow-50";
  return "";
}

export default function StockAgeingReportPage() {
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
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
    asOnDate: new Date().toISOString().slice(0, 10),
    branchId: "",
    search: "",
    status: "in_stock",
  });

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
        `${API_BASE}/api/reports/stock/ageing${queryString ? `?${queryString}` : ""}`,
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
        console.error("Stock ageing API error:", res.status, text);
        throw new Error(`Stock ageing failed: ${res.status}`);
      }

      const data = await res.json();

      setSummary(
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
      setBranchWise(Array.isArray(data?.branchWise) ? data.branchWise : []);
      setModelWise(Array.isArray(data?.modelWise) ? data.modelWise : []);
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (error) {
      console.error("Failed to load stock ageing report", error);
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

  const ageingPieData = [
    { label: "0-7 Days", value: Number(summary.bucket_0_7 || 0) },
    { label: "8-15 Days", value: Number(summary.bucket_8_15 || 0) },
    { label: "16-30 Days", value: Number(summary.bucket_16_30 || 0) },
    { label: "31-60 Days", value: Number(summary.bucket_31_60 || 0) },
    { label: "61-90 Days", value: Number(summary.bucket_61_90 || 0) },
    { label: "90+ Days", value: Number(summary.bucket_90_plus || 0) },
  ];

  const deadStockModels = modelWise
    .map((m) => ({
      label: m.model_label,
      value: Number(m.bucket_90_plus || 0),
    }))
    .filter((x) => x.value > 0)
    .slice(0, 8);

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
          <h1 className="text-2xl font-bold">Stock Ageing Report</h1>
          <p className="text-sm text-gray-600 mt-1">
            Stock bucket analysis with dead stock alerts.
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
            <label className="block text-sm font-medium mb-1">As On Date</label>
            <input
              type="date"
              value={filters.asOnDate}
              onChange={(e) => handleChange("asOnDate", e.target.value)}
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

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleChange("status", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="in_stock">In Stock</option>
              <option value="sold">Sold</option>
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

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <StatCard label="Total Units" value={summary.total_units || 0} />
        <StatCard label="0-7 Days" value={summary.bucket_0_7 || 0} />
        <StatCard label="8-15 Days" value={summary.bucket_8_15 || 0} />
        <StatCard label="16-30 Days" value={summary.bucket_16_30 || 0} />
        <StatCard label="31-60 Days" value={summary.bucket_31_60 || 0} />
        <StatCard label="61-90 Days" value={summary.bucket_61_90 || 0} className="border-orange-300" />
        <StatCard label="90+ Dead Stock" value={summary.bucket_90_plus || 0} className="border-red-300 bg-red-50" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="Ageing Bucket Pie Chart">
          <SimplePieChart data={ageingPieData} title="Stock Ageing Distribution" />
        </SectionCard>

        <SectionCard title="Dead Stock Models (90+ Days)">
          <SimpleBarChart
            data={deadStockModels.length ? deadStockModels : [{ label: "No Dead Stock", value: 0 }]}
            title="Top Dead Stock Models"
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="Branch-wise Ageing">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
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
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                      {loading ? "Loading..." : "No branch records found"}
                    </td>
                  </tr>
                ) : (
                  branchWise.map((row, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-3 py-2">{row.branch_name}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.total_units}</td>
                      <td className="px-3 py-2 text-right">{row.bucket_0_7}</td>
                      <td className="px-3 py-2 text-right">{row.bucket_8_15}</td>
                      <td className="px-3 py-2 text-right">{row.bucket_16_30}</td>
                      <td className="px-3 py-2 text-right">{row.bucket_31_60}</td>
                      <td className="px-3 py-2 text-right text-orange-700">{row.bucket_61_90}</td>
                      <td className="px-3 py-2 text-right text-red-700 font-semibold">{row.bucket_90_plus}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Model-wise Ageing">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
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
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                      {loading ? "Loading..." : "No model records found"}
                    </td>
                  </tr>
                ) : (
                  modelWise.map((row, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-3 py-2">{row.model_label}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.total_units}</td>
                      <td className="px-3 py-2 text-right">{row.bucket_0_7}</td>
                      <td className="px-3 py-2 text-right">{row.bucket_8_15}</td>
                      <td className="px-3 py-2 text-right">{row.bucket_16_30}</td>
                      <td className="px-3 py-2 text-right">{row.bucket_31_60}</td>
                      <td className="px-3 py-2 text-right text-orange-700">{row.bucket_61_90}</td>
                      <td className="px-3 py-2 text-right text-red-700 font-semibold">{row.bucket_90_plus}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Detailed Stock Ageing Table">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
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
                  <td colSpan={11} className="px-3 py-6 text-center text-gray-500">
                    {loading ? "Loading..." : "No stock records found"}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={`border-t ${rowAlertClass(Number(row.ageing_days || 0))}`}>
                    <td className="px-3 py-2">{row.id}</td>
                    <td className="px-3 py-2">
                      {row.inward_date ? String(row.inward_date).slice(0, 10) : ""}
                    </td>
                    <td className="px-3 py-2">{row.branch_name || ""}</td>
                    <td className="px-3 py-2">{row.vehicle_name || ""}</td>
                    <td className="px-3 py-2">{row.chassis_number || ""}</td>
                    <td className="px-3 py-2">{row.engine_number || ""}</td>
                    <td className="px-3 py-2">{row.status_code || ""}</td>
                    <td className="px-3 py-2">{row.customer_name || ""}</td>
                    <td className="px-3 py-2">{row.mobile_number || ""}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {row.ageing_days || 0}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${bucketBadgeClass(row.ageing_bucket)}`}>
                        {row.ageing_bucket}
                      </span>
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