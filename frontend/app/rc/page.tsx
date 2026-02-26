"use client";

import { useEffect, useState } from "react";

type RCRecord = {
  sale_id: number;
  customer_name: string;
  vehicle_model: string;
  rc_number?: string;
  rc_required: number;
  rc_done: number;
  insurance_done: number;
  hsrp_done: number;
};

export default function RCPage() {
  const [records, setRecords] = useState<RCRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    fetch("http://localhost:5000/api/vahan", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setRecords(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="p-6">Loading RC / Vahan records…</p>;
  }

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">RC / VAHAN</h1>
        <p className="text-sm text-gray-600">
          RC processing & VAHAN submission status
        </p>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Vehicle</th>
              <th className="p-3 text-center">Insurance</th>
              <th className="p-3 text-center">HSRP</th>
              <th className="p-3 text-center">RC Required</th>
              <th className="p-3 text-center">RC Done</th>
            </tr>
          </thead>

          <tbody>
            {records.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-4 text-center text-gray-500"
                >
                  No RC / Vahan records found
                </td>
              </tr>
            )}

            {records.map((r) => (
              <tr
                key={r.sale_id}
                className="border-t hover:bg-gray-50"
              >
                <td className="p-3 font-medium">
                  {r.customer_name}
                </td>
                <td className="p-3">{r.vehicle_model}</td>

                <td className="p-3 text-center">
                  {r.insurance_done ? "✅" : "❌"}
                </td>

                <td className="p-3 text-center">
                  {r.hsrp_done ? "✅" : "❌"}
                </td>

                <td className="p-3 text-center">
                  {r.rc_required ? "YES" : "NO"}
                </td>

                <td className="p-3 text-center font-semibold">
                  {r.rc_done ? "COMPLETED" : "PENDING"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
