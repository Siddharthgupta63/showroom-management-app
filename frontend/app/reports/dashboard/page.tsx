"use client";

import React, { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";

export default function ReportsDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/reports/dashboard");
        setStats(res.data?.data || res.data);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AuthGuard roles={["owner", "manager"]}>
      <div className="min-h-screen p-6 bg-gray-100">

        <h1 className="text-3xl font-bold mb-6">Business Dashboard</h1>

        {loading && <p>Loading dashboard...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {stats && (
          <>
            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <Card label="Total Sales" value={stats.total_sales} color="bg-blue-600" />
              <Card label="Pending RC" value={stats.pending_rc} color="bg-orange-600" />
              <Card label="Pending Insurance" value={stats.pending_insurance} color="bg-purple-600" />
              <Card label="Pending Renewal" value={stats.pending_renewal} color="bg-yellow-600" />
              <Card label="Pending HSRP" value={stats.pending_hsrp} color="bg-red-600" />
              <Card label="Total Incentives" value={stats.total_incentives} color="bg-green-600" />
            </div>

            {/* MONTHLY SALES BAR CHART */}
            <div className="bg-white p-6 rounded shadow">
              <h2 className="text-xl font-semibold mb-4">Monthly Sales Trend</h2>

              <div className="flex items-end gap-4 h-48 border-b pb-2">
                {stats.monthly?.map((m: any, i: number) => (
                  <div key={i} className="text-center">
                    <div
                      className="bg-blue-600 mx-auto"
                      style={{
                        width: "30px",
                        height: `${m.sales * 5}px`,
                      }}
                    ></div>
                    <div className="text-xs mt-1">{m.month}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      </div>
    </AuthGuard>
  );
}

function Card({ label, value, color }: any) {
  return (
    <div className={`p-6 rounded shadow text-white ${color}`}>
      <div className="text-lg">{label}</div>
      <div className="text-3xl font-bold">{value ?? 0}</div>
    </div>
  );
}
