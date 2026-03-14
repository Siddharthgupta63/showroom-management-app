"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { getUser } from "@/lib/auth";

type EmployeeOption = {
  id: number;
  name: string;
};

type HSRPRecord = {
  sale_id: number;
  customer_name: string;
  mobile_number: string;
  vehicle_model: string;
  sale_date?: string;
  rto_number?: string;
  hsrp_number?: string;
  hsrp_issued_date?: string;
  plate_received: number;
  plate_received_date?: string;
  hsrp_installed: number;
  fitment_date?: string;
  amount_paid?: string | number;
  fitment_by?: number | null;
  fitment_by_name?: string;
  notes?: string;
  status: string;
};

type FormState = {
  sale_id: number;
  hsrp_number: string;
  hsrp_issued_date: string;
  plate_received: number;
  plate_received_date: string;
  hsrp_installed: number;
  fitment_date: string;
  amount_paid: string;
  fitment_by: string;
  notes: string;
};

function fmtDate(d?: string) {
  if (!d) return "-";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "-";
  return x.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function badgeClass(status: string) {
  const s = String(status || "").toLowerCase();
  if (s.includes("fitment")) return "bg-green-100 text-green-800";
  return "bg-orange-100 text-orange-800";
}

export default function HSRPPage() {
  const router = useRouter();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const user = getUser();
  const role = String(user?.role || "").toLowerCase();
  const isOwnerAdmin = role === "owner" || role === "admin";

  const canExport = isOwnerAdmin || hasPermission("hsrp_export");
  const canCreateOldFitment = isOwnerAdmin || hasPermission("hsrp_old_customer_fitment");

  const [records, setRecords] = useState<HSRPRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [form, setForm] = useState<FormState | null>(null);

  const loadEmployees = async () => {
    try {
      const res = await api.get("/api/hsrp/fitment-employees");
      const arr = Array.isArray(res.data) ? res.data : [];
      setEmployees(
        arr.map((u: any) => ({
          id: Number(u.id),
          name: String(u.name || `User #${u.id}`),
        }))
      );
    } catch (e) {
      console.error("Employee load error", e);
      setEmployees([]);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/hsrp", {
        params: {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        },
      });
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("HSRP load error", e);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  useEffect(() => {
    loadEmployees();
  }, []);

  const filtered = useMemo(() => {
    let data = [...records];

    if (filter !== "all") {
      data = data.filter((r) => r.status === filter);
    }

    const search = q.trim().toLowerCase();
    if (search) {
      data = data.filter((r) =>
        [
          r.customer_name,
          r.mobile_number,
          r.vehicle_model,
          r.hsrp_number || "",
          r.rto_number || "",
          r.fitment_by_name || "",
          String(r.sale_id),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)
      );
    }

    return data;
  }, [records, filter, q]);

  const openEdit = (r: HSRPRecord) => {
    setForm({
      sale_id: r.sale_id,
      hsrp_number: r.hsrp_number || r.rto_number || "",
      hsrp_issued_date: r.hsrp_issued_date ? String(r.hsrp_issued_date).slice(0, 10) : "",
      plate_received: Number(r.plate_received || 0),
      plate_received_date: r.plate_received_date ? String(r.plate_received_date).slice(0, 10) : "",
      hsrp_installed: Number(r.hsrp_installed || 0),
      fitment_date: r.fitment_date ? String(r.fitment_date).slice(0, 10) : "",
      amount_paid:
        r.amount_paid !== null && r.amount_paid !== undefined && String(r.amount_paid) !== "0"
          ? String(r.amount_paid)
          : "",
      fitment_by: r.fitment_by ? String(r.fitment_by) : "",
      notes: r.notes || "",
    });
  };

  const save = async () => {
    if (!form) return;

    if (!form.hsrp_number.trim()) {
      alert("HSRP number is required.");
      return;
    }

    if (form.plate_received === 1 && !form.plate_received_date) {
      alert("Plate received date is required.");
      return;
    }

    if (form.hsrp_installed === 1 && form.plate_received !== 1) {
      alert("Cannot mark fitment done before plate received.");
      return;
    }

    if (form.hsrp_installed === 1 && !form.fitment_date) {
      alert("Fitment date is required when fitment is done.");
      return;
    }

    if (!String(form.amount_paid || "").trim()) {
      alert("Amount paid is required.");
      return;
    }

    if (form.hsrp_installed === 1 && !String(form.fitment_by || "").trim()) {
      alert("Fitment by is required when fitment is done.");
      return;
    }

    try {
      setSaving(true);
      await api.put(`/api/hsrp/${form.sale_id}`, form);
      setForm(null);
      await load();
    } catch (e: any) {
      console.error("HSRP save error", e);
      alert(e?.response?.data?.message || "Failed to save HSRP");
    } finally {
      setSaving(false);
    }
  };

  const exportNow = async () => {
    if (!canExport) {
      alert("You do not have permission to export HSRP data.");
      return;
    }

    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token") || localStorage.getItem("showroom_token")
          : "";

      const params = new URLSearchParams();
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (q.trim()) params.set("search", q.trim());
      if (filter !== "all") params.set("status", filter);

      const base = api.defaults.baseURL || "";
      const res = await fetch(`${base}/api/hsrp/export?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        let message = "Export failed";
        try {
          const data = await res.json();
          if (data?.message) message = data.message;
        } catch {}
        throw new Error(message);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hsrp_export.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "Export failed");
    }
  };

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">HSRP</h1>
            <p className="text-sm text-gray-600">Order → Receive plate → Fitment</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {!permissionsLoading && canCreateOldFitment && (
              <button
                onClick={() => router.push("/hsrp/old-customer")}
                className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-800"
              >
                + Old Customer Fitment
              </button>
            )}

            {!permissionsLoading && canExport && (
              <button
                onClick={exportNow}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                Export
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 mb-4 border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="text-sm text-gray-600 mb-1 block">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search customer / mobile / vehicle / HSRP no / fitment by / sale id"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1 block">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1 block">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1 block">Status</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              >
                <option value="all">All</option>
                <option value="Pending Order">Pending Order</option>
                <option value="Ordered">Ordered</option>
                <option value="Plate Received / Fitment Pending">
                  Plate Received / Fitment Pending
                </option>
                <option value="Fitment Done">Fitment Done</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-x-auto border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-3 text-left">Sale ID</th>
                <th className="p-3 text-left">Customer</th>
                <th className="p-3 text-left">Vehicle</th>
                <th className="p-3 text-left">HSRP No</th>
                <th className="p-3 text-center">Order Date</th>
                <th className="p-3 text-center">Plate Received</th>
                <th className="p-3 text-center">Fitment</th>
                <th className="p-3 text-left">Fitment By</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="p-4 text-center">
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-4 text-center text-gray-500">
                    No HSRP records found
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((r) => (
                  <tr key={r.sale_id} className="border-t hover:bg-gray-50">
                    <td className="p-3">{r.sale_id}</td>
                    <td className="p-3 font-medium">{r.customer_name}</td>
                    <td className="p-3">{r.vehicle_model}</td>
                    <td className="p-3">{r.hsrp_number || r.rto_number || "-"}</td>
                    <td className="p-3 text-center">{fmtDate(r.hsrp_issued_date)}</td>
                    <td className="p-3 text-center">
                      {r.plate_received
                        ? `YES${r.plate_received_date ? ` (${fmtDate(r.plate_received_date)})` : ""}`
                        : "NO"}
                    </td>
                    <td className="p-3 text-center">
                      {r.hsrp_installed
                        ? `DONE${r.fitment_date ? ` (${fmtDate(r.fitment_date)})` : ""}`
                        : "PENDING"}
                    </td>
                    <td className="p-3">{r.fitment_by_name || "-"}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass(r.status)}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => openEdit(r)}
                        className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {form && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-5">
              <div className="text-xl font-bold mb-4">Update HSRP – Sale #{form.sale_id}</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block md:col-span-2">
                  <div className="text-sm mb-1">HSRP Number</div>
                  <input
                    value={form.hsrp_number}
                    readOnly
                    className="w-full border rounded-lg px-3 py-2 bg-slate-100 cursor-not-allowed"
                  />
                </label>

                <label className="block">
                  <div className="text-sm mb-1">Order Date</div>
                  <input
                    type="date"
                    value={form.hsrp_issued_date}
                    onChange={(e) => setForm({ ...form, hsrp_issued_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </label>

                <label className="block">
                  <div className="text-sm mb-1">Plate Received</div>
                  <select
                    value={form.plate_received}
                    onChange={(e) => setForm({ ...form, plate_received: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value={0}>No</option>
                    <option value={1}>Yes</option>
                  </select>
                </label>

                <label className="block">
                  <div className="text-sm mb-1">Plate Received Date</div>
                  <input
                    type="date"
                    value={form.plate_received_date}
                    required={form.plate_received === 1}
                    onChange={(e) => setForm({ ...form, plate_received_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </label>

                <label className="block">
                  <div className="text-sm mb-1">Fitment Done</div>
                  <select
                    value={form.hsrp_installed}
                    onChange={(e) => setForm({ ...form, hsrp_installed: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value={0}>No</option>
                    <option value={1}>Yes</option>
                  </select>
                </label>

                <label className="block">
                  <div className="text-sm mb-1">Fitment Date</div>
                  <input
                    type="date"
                    value={form.fitment_date}
                    required={form.hsrp_installed === 1}
                    onChange={(e) => setForm({ ...form, fitment_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </label>

                <label className="block md:col-span-2">
                  <div className="text-sm mb-1">Fitment By</div>
                  <select
                    value={form.fitment_by}
                    onChange={(e) => setForm({ ...form, fitment_by: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <div className="text-sm mb-1">Amount Paid</div>
                  <input
                    type="number"
                    value={form.amount_paid}
                    onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </label>

                <label className="block md:col-span-2">
                  <div className="text-sm mb-1">Notes</div>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 min-h-[100px]"
                  />
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setForm(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}