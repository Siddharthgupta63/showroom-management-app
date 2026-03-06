"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import { useRouter } from "next/navigation";

export default function CreateRenewalPage() {
  const router = useRouter();

  const [sales, setSales] = useState<any[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  const [form, setForm] = useState({
    sale_id: "",
    expiry_date: "",
    status: "pending",
  });

  const [file, setFile] = useState<File | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleChange(e: any) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // Load sales for dropdown
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

    if (!file) {
      setError("Please upload a document file");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const fd = new FormData();
      fd.append("sale_id", form.sale_id);
      fd.append("expiry_date", form.expiry_date);
      fd.append("status", form.status);
      fd.append("document", file); // VERY IMPORTANT

      const res = await api.post("/renewal", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success) {
        router.push("/renewal");
      } else {
        throw new Error(res.data?.message || "Failed to create renewal");
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
        <h1 className="text-3xl font-bold mb-6">Add Renewal</h1>

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

          {/* EXPIRY DATE */}
          <label className="block mb-2">
            Expiry Date
            <input
              type="date"
              name="expiry_date"
              value={form.expiry_date}
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

          {/* FILE UPLOAD */}
          <label className="block mb-2">
            Upload Document (PDF/Image)
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full mt-1"
            />
          </label>

          {error && <p className="text-red-600 mb-3">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-blue-600 text-white p-3 rounded mt-4"
          >
            {busy ? "Saving..." : "Save Renewal"}
          </button>
        </form>
      </div>
    </AuthGuard>
  );
}
