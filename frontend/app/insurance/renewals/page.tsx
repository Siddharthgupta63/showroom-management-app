"use client";

import { useEffect, useState } from "react";

type Renewal = {
  id: number;
  customer_name: string;
  mobile_number: string;
  vehicle_model: string;
  company: string;
  policy_number: string;
  expiry_date: string;
  premium_amount: number;
};

export default function InsuranceRenewalsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    fetch("/api/insurance/renewals", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setRenewals(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="p-6">Loading insurance renewals…</p>;
  }

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-red-600">
          Insurance Renewals
        </h1>
        <p className="text-sm text-gray-600">
          Policies expiring soon or already expired
        </p>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Mobile</th>
              <th className="p-3 text-left">Vehicle</th>
              <th className="p-3 text-left">Company</th>
              <th className="p-3 text-left">Policy No</th>
              <th className="p-3 text-center">Expiry</th>
              <th className="p-3 text-right">Premium</th>
            </tr>
          </thead>

          <tbody>
            {renewals.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-4 text-center text-gray-500"
                >
                  No renewal alerts found 🎉
                </td>
              </tr>
            )}

            {renewals.map((r) => {
              const daysLeft =
                Math.ceil(
                  (new Date(r.expiry_date).getTime() -
                    new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                );

              const danger = daysLeft <= 7;

              return (
                <tr
                  key={r.id}
                  className={`border-t ${
                    danger ? "bg-red-50" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="p-3 font-medium">
                    {r.customer_name}
                  </td>
                  <td className="p-3">{r.mobile_number}</td>
                  <td className="p-3">{r.vehicle_model}</td>
                  <td className="p-3">{r.company}</td>
                  <td className="p-3">{r.policy_number}</td>
                  <td className="p-3 text-center font-semibold">
                    {mounted ? new Date(r.expiry_date).toLocaleDateString() : "-"}
                    <div
                      className={`text-xs ${
                        danger ? "text-red-600" : "text-gray-500"
                      }`}
                    >
                      {daysLeft < 0
                        ? "Expired"
                        : `${daysLeft} days left`}
                    </div>
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {mounted ? `₹${Number(r.premium_amount).toLocaleString("en-IN")}` : "₹0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
