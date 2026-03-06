"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import { useRouter } from "next/navigation";

export default function CreateInsurancePage() {
  const router = useRouter();

  const [sales, setSales] = useState<any[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  const [form, setForm] = useState({
    sale_id: "",
    company: "",
    policy_number: "",
    premium_amount: "",
    status: "pending",
  });

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleChange(e: any) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // Load sales list so user can link insurance to a sale
  useEffect(() => {
    async function loadSales() {
      try {
        const res = await api.get("/sales");
        setSales(res.data?.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSales(false);
      }
    }
    loadSales();
  }, []);

  async function handleSubmit(e: any) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await api.post("/insurance", form);

      if (res.data?.success) {
        router.push("/insurance");
      } else {
        throw new Error(res.data?.message || "Failed to create insurance");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGuard roles={["owner", "manager", "sales"]}>
      <div className="min-h-screen p-6 bg-gray-100">
        <h1 className="text-3xl font-bold mb-6">Add Insurance</h1>

        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded shadow max-w-lg"
        >
          {/* SALE ID SELECT */}
          <label className="block mb-2">
            Select Sale
            <select
              name="sale_id"
              value={form.sale_id}
              onChange={handleChange}
              className="w-full p-2 border rounded mt-1"
              required
            >
              <option value="">-- Select Sale --</option>
              {sales.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.id} - {s.customer_name} ({s.model})
                </option>
              ))}
            </select>
          </label>

          {/* INSURANCE COMPANY */}
          <label className="block mb-2">
            Insurance Company
            <input
              name="company"
              value={form.company}
              onChange={handleChange}
              className="w-full p-2 border rounded mt-1"
              required
            />
          </label>

          {/* POLICY NUMBER */}
          <label className="block mb-2">
            Policy Number
            <input
              name="policy_number"
              value={form.policy_number}
              onChange={handleChange}
              className="w-full p-2 border rounded mt-1"
            />
          </label>

          {/* PREMIUM AMOUNT */}
          <label className="block mb-2">
            Premium Amount
            <input
              name="premium_amount"
              type="number"
              value={form.premium_amount}
              onChange={handleChange}
              className="w-full p-2 border rounded mt-1"
            />
          </label>

          {/* STATUS */}
          <label className="block mb-2">
            Status
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full p-2 border rounded mt-1"
            >
              <option value="pending">Pending</option>
              <option value="done">Done</option>
            </select>
          </label>

          {error && <p className="text-red-600 mb-4">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-blue-600 text-white p-3 rounded mt-4"
          >
            {busy ? "Saving..." : "Save Insurance"}
          </button>
        </form>
      </div>
    </AuthGuard>
  );
}
