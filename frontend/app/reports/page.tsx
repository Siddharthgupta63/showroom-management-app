"use client";

import React, { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/reports/summary");
        setSummary(res.data?.data || res.data);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load summary report");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AuthGuard roles={["owner", "manager"]}>
      <div className="min-h-screen p-6 bg-gray-100">
        
        <h1 className="text-3xl font-bold mb-6">Summary Reports</h1>

        {loading && <p>Loading report...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <ReportCard label="Total Sales" value={summary.total_sales} color="bg-blue-600" />
            <ReportCard label="Pending Insurance" value={summary.pending_insurance} color="bg-indigo-600" />
            <ReportCard label="Pending HSRP" value={summary.pending_hsrp} color="bg-orange-600" />
            <ReportCard label="Pending RC" value={summary.pending_rc} color="bg-purple-600" />
            <ReportCard label="Pending Renewal" value={summary.pending_renewal} color="bg-yellow-600" />
            <ReportCard label="Total Incentives" value={summary.total_incentives} color="bg-green-600" />

          </div>
        )}

      </div>
    </AuthGuard>
  );
}

function ReportCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className={`p-6 rounded shadow text-white ${color}`}>
      <div className="text-lg">{label}</div>
      <div className="text-3xl font-bold">{value ?? 0}</div>
    </div>
  );
}
