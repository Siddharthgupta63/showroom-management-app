"use client";

import React, { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import Link from "next/link";

export default function VahanPage() {
  const [loading, setLoading] = useState(true);
  const [vahanList, setVahanList] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/vahan");
        setVahanList(res.data?.data || res.data || []);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load Vahan records");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AuthGuard roles={["owner", "manager", "rc"]}>
      <div className="min-h-screen p-6 bg-gray-100">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Vahan Updates</h1>

          <Link
            href="/vahan/create"
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            + Add Vahan Update
          </Link>
        </div>

        {loading && <p>Loading Vahan data...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && vahanList.length === 0 && (
          <p className="text-gray-600">No Vahan records found.</p>
        )}

        {!loading && vahanList.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full bg-white rounded shadow">
              <thead className="bg-gray-200 text-left">
                <tr>
                  <th className="p-2">ID</th>
                  <th className="p-2">Sale ID</th>
                  <th className="p-2">Application No</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Completed On</th>
                </tr>
              </thead>
              <tbody>
                {vahanList.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="p-2">{v.id}</td>
                    <td className="p-2">{v.sale_id}</td>
                    <td className="p-2">{v.application_no}</td>
                    <td className="p-2 capitalize">{v.status}</td>
                    <td className="p-2">
                      {v.completed_date ? v.completed_date.slice(0, 10) : "-"}
                    </td>
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
