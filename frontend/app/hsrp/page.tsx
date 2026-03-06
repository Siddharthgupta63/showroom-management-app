"use client";

import { useEffect, useState } from "react";

type HSRPRecord = {
  sale_id: number;
  customer_name: string;
  vehicle_model: string;
  hsrp_required: number;
  hsrp_number?: string;
  hsrp_fee?: number;
  hsrp_issued_date?: string;
  hsrp_installed?: number;
  fitment_date?: string;
};

export default function HSRPPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [records, setRecords] = useState<HSRPRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    fetch("/api/hsrp", {
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
    return <p className="p-6">Loading HSRP records…</p>;
  }

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">HSRP</h1>
        <p className="text-sm text-gray-600">
          High Security Registration Plate status
        </p>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Vehicle</th>
              <th className="p-3 text-center">Required</th>
              <th className="p-3 text-left">HSRP No</th>
              <th className="p-3 text-right">Fee</th>
              <th className="p-3 text-center">Issued</th>
              <th className="p-3 text-center">Installed</th>
            </tr>
          </thead>

          <tbody>
            {records.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-4 text-center text-gray-500"
                >
                  No HSRP records found
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
                  {r.hsrp_required ? "YES" : "NO"}
                </td>

                <td className="p-3">
                  {r.hsrp_number || "-"}
                </td>

                <td className="p-3 text-right font-semibold">
                  {r.hsrp_fee
                    ? mounted
                      ? `₹${Number(r.hsrp_fee).toLocaleString("en-IN")}`
                      : "₹0"
                    : "-"}
                </td>

                <td className="p-3 text-center">
                  {r.hsrp_issued_date
                    ? mounted
                      ? new Date(r.hsrp_issued_date).toLocaleDateString()
                      : "-"
                    : "❌"}
                </td>

                <td className="p-3 text-center font-semibold">
                  {r.hsrp_installed ? "COMPLETED" : "PENDING"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
