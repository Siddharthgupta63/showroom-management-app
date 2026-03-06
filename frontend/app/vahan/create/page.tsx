"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import { useRouter } from "next/navigation";

export default function CreateVahanPage() {
  const router = useRouter();

  const [sales, setSales] = useState<any[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  const [form, setForm] = useState({
    sale_id: "",
    application_no: "",
    status: "pending",
    completed_date: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleChange(e: any) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

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
      const res = await api.post("/vahan", form);

      if (res.data?.success) {
        router.push("/vahan");
      } else {
        throw new Error(res.data?.message || "Failed to create Vahan record");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGuard roles={["owner", "manager", "rc"]}>
      <div className="min-h-screen p-6 bg-gray-100">
        
        <h1 className="text-3xl font-bold mb-6">Add Vahan Update</h1>

        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded shadow max-w-lg"
        >
          {/* SALE SELECT */}
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

          {/* APPLICATION NO */}
          <label className="block mb-2">
            Application No
            <input
              name="application_no"
              value={form.application_no}
              onChange={handleChange}
              className="w-full p-2 border rounded mt-1"
              required
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

          {/* COMPLETED DATE */}
          <label className="block mb-2">
            Completed Date (optional)
            <input
              type="date"
              name="completed_date"
              value={form.completed_date}
              onChange={handleChange}
              className="w-full p-2 border rounded mt-1"
            />
          </label>

          {error && <p className="text-red-600 mb-3">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-blue-600 text-white p-3 rounded mt-4"
          >
            {busy ? "Saving..." : "Save Vahan"}
          </button>
        </form>
      </div>
    </AuthGuard>
  );
}
