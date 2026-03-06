"use client";

import React, { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";

export default function IncentiveReportPage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/reports/incentives");
        setList(res.data?.data || res.data || []);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load incentive report");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AuthGuard roles={["owner", "manager"]}>
      <div className="min-h-screen p-6 bg-gray-100">

        <h1 className="text-3xl font-bold mb-6">Incentive Details</h1>

        {loading && <p>Loading incentives...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && list.length === 0 && (
          <p className="text-gray-600">No incentives found.</p>
        )}

        {!loading && list.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full bg-white rounded shadow">
              <thead className="bg-gray-200 text-left">
                <tr>
                  <th className="p-2">Sale ID</th>
                  <th className="p-2">Customer</th>
                  <th className="p-2">HSRP Incentive</th>
                  <th className="p-2">Process Incentive</th>
                  <th className="p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.sale_id} className="border-t">
                    <td className="p-2">{i.sale_id}</td>
                    <td className="p-2">{i.customer_name}</td>
                    <td className="p-2">₹ {i.hsrp_incentive}</td>
                    <td className="p-2">₹ {i.process_incentive}</td>
                    <td className="p-2 font-bold">₹ {i.total_incentive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </AuthGuard>
  );
}
