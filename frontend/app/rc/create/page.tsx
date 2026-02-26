"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import { useRouter } from "next/navigation";

export default function CreateRcPage() {
  const router = useRouter();

  const [sales, setSales] = useState<any[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  const [form, setForm] = useState({
    sale_id: "",
    registration_no: "",
    file_number: "",
    status: "pending",
    submission_date: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleChange(e: any) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // Load sales list
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

  // Submit RC form
  async function handleSubmit(e: any) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await api.post("/rc", form);

      if (res.data?.success) {
        router.push("/rc");
      } else {
        throw new Error(res.data?.message || "Failed to create RC record");
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
        <h1 className="text-3xl font-bold mb-6">Add RC</h1>

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

          {/* Registration Number */}
          <label className="block mb-2">
            Registration Number
            <input
              name="registration_no"
              value={form.registration_no}
              onChange={handleChange}
              className="w-full p-2 border rounded mt-1"
              required
            />
          </label>

          {/* File Number */}
          <label className="block mb-2">
            File Number
            <input
              name="file_number"
              value={form.file_number}
              onChange={handleChange}
              className="w-full p-2 border rounded mt-1"
            />
          </label>

          {/* Submission Date */}
          <label className="block mb-2">
            Submission Date
            <input
              type="date"
              name="submission_date"
              value={form.submission_date}
              onChange={handleChange}
              className="w-full p-2 border rounded mt-1"
              required
            />
          </label>

          {/* Status */}
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

          {error && <p className="text-red-600 mb-3">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-blue-600 text-white p-3 rounded mt-4"
          >
            {busy ? "Saving..." : "Save RC"}
          </button>
        </form>
      </div>
    </AuthGuard>
  );
}
