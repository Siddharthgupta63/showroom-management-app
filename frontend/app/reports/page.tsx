"use client";

import Link from "next/link";

const reportCards = [
  {
    title: "Sales Report",
    description: "Date-wise, branch-wise and customer-wise sales summary",
    href: "/reports/sales",
  },
  {
    title: "Stock Report",
    description: "Current stock, sold vehicles and ageing analysis",
    href: "/reports/stock",
  },
];

export default function ReportsHomePage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-gray-600 mt-1">
          View operational and business reports.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportCards.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border bg-white shadow-sm p-5 hover:shadow-md transition"
          >
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="text-sm text-gray-600 mt-2">{item.description}</p>
            <div className="mt-4 text-sm font-medium text-blue-600">
              Open Report →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}