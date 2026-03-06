"use client";

import React, { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import Link from "next/link";

export default function RenewalPage() {
  const [loading, setLoading] = useState(true);
  const [renewals, setRenewals] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/renewal");
        setRenewals(res.data?.data || res.data || []);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load renewals");
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
          <h1 className="text-3xl font-bold">Renewal Records</h1>

          <Link
            href="/renewal/create"
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            + Add Renewal
          </Link>
        </div>

        {loading && <p>Loading renewal data...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && renewals.length === 0 && (
          <p className="text-gray-600">No renewal records found.</p>
        )}

        {!loading && renewals.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full bg-white rounded shadow">
              <thead className="bg-gray-200 text-left">
                <tr>
                  <th className="p-2">ID</th>
                  <th className="p-2">Sale ID</th>
                  <th className="p-2">Expiry Date</th>
                  <th className="p-2">Document</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {renewals.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.id}</td>
                    <td className="p-2">{r.sale_id}</td>
                    <td className="p-2">{r.expiry_date?.slice(0, 10)}</td>
                    <td className="p-2">
                      {r.document_url ? (
                        <a
                          href={r.document_url}
                          target="_blank"
                          className="text-blue-600 underline"
                        >
                          View File
                        </a>
                      ) : (
                        "No file"
                      )}
                    </td>
                    <td className="p-2 capitalize">{r.status || "pending"}</td>
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
