"use client";

import { useEffect, useMemo, useState } from "react";
import ReportFilters from "@/components/reports/ReportFilters";
import ReportSummaryCards from "@/components/reports/ReportSummaryCards";
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
  name: string;
};

export default function StockReportPage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
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

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/branches`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("showroom_token") || ""}`,
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
            Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("showroom_token") || ""}`,
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Stock report API error:", res.status, text);
        throw new Error(`Stock report failed: ${res.status}`);
      }

      const data = await res.json();

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setSummary(
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

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Stock Report</h1>
          <p className="text-sm text-gray-600 mt-1">
            View current stock, sold stock and ageing summary.
          </p>
        </div>
        <ExportButton url={exportUrl} />
      </div>

      <ReportFilters
        values={filters}
        onChange={handleChange}
        onApply={handleApply}
        onReset={handleReset}
        branchOptions={branches.map((b) => ({
          value: String(b.id),
          label: b.name,
        }))}
        showStatus
        statusOptions={[
          { value: "in_stock", label: "In Stock" },
          { value: "sold", label: "Sold" },
        ]}
      />

      <ReportSummaryCards
        cards={[
          { label: "Total Stock", value: summary.total_stock || 0 },
          { label: "In Stock", value: summary.in_stock_count || 0 },
          { label: "Sold", value: summary.sold_count || 0 },
          { label: "0-30 Days", value: summary.ageing_0_30 || 0 },
          { label: "31-60 Days", value: summary.ageing_31_60 || 0 },
          { label: "61-90 Days", value: summary.ageing_61_90 || 0 },
          { label: "90+ Days", value: summary.ageing_90_plus || 0 },
        ]}
      />

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 sticky top-0 z-10">
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
                      {row.created_at ? String(row.created_at).slice(0, 10) : ""}
                    </td>
                    <td className="px-3 py-2">{row.branch_name || ""}</td>
                    <td className="px-3 py-2">{row.vehicle_name || ""}</td>
                    <td className="px-3 py-2">{row.chassis_number || ""}</td>
                    <td className="px-3 py-2">{row.engine_number || ""}</td>
                    <td className="px-3 py-2">{row.status_code || ""}</td>
                    <td className="px-3 py-2">{row.customer_name || ""}</td>
                    <td className="px-3 py-2">{row.mobile_number || ""}</td>
                    <td className="px-3 py-2 text-right">{row.ageing_days || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}