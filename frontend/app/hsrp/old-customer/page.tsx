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

type OldFitmentRow = {
  id: number;
  customer_name: string;
  mobile_number?: string;
  hsrp_number: string;
  fitment_date: string;
  amount_paid?: string | number;
  fitment_by?: number | null;
  fitment_by_name?: string | null;
  notes?: string;
  created_at?: string;
};

type OldCustomerFitmentForm = {
  customer_name: string;
  mobile_number: string;
  hsrp_number: string;
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

export default function OldCustomerHSRPPage() {
  const router = useRouter();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const user = getUser();
  const role = String(user?.role || "").toLowerCase();
  const isOwnerAdmin = role === "owner" || role === "admin";

  const canExport = isOwnerAdmin || hasPermission("hsrp_export");
  const canCreate = isOwnerAdmin || hasPermission("hsrp_old_customer_fitment");

  const [rows, setRows] = useState<OldFitmentRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [form, setForm] = useState<OldCustomerFitmentForm>({
    customer_name: "",
    mobile_number: "",
    hsrp_number: "",
    fitment_date: "",
    amount_paid: "",
    fitment_by: "",
    notes: "",
  });

  const loadEmployees = async () => {
  try {
    const res = await api.get("/api/hsrp/fitment-employees");

    const arr = Array.isArray(res.data) ? res.data : [];

    const mapped = arr.map((u: any) => ({
      id: Number(u.id),
      name: String(u.name || `User #${u.id}`),
    }));

    setEmployees(mapped);
  } catch (e) {
    console.error("Employee load error", e);
    setEmployees([]);
  }
};

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/hsrp/old-fitment", {
        params: {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          search: q || undefined,
        },
      });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Old HSRP load error", e);
      setRows([]);
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
    const search = q.trim().toLowerCase();
    if (!search) return rows;

    return rows.filter((r) =>
      [
        r.customer_name,
        r.mobile_number || "",
        r.hsrp_number || "",
        r.fitment_by_name || "",
        String(r.id),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }, [rows, q]);

  const save = async () => {
    if (!canCreate) {
      alert("You do not have permission.");
      return;
    }

    if (!form.customer_name.trim()) {
      alert("Customer name is required.");
      return;
    }

    if (!form.mobile_number.trim()) {
  alert("Mobile number is required.");
  return;
}
if (!/^[0-9]{10}$/.test(form.mobile_number)) {
  alert("Mobile number must be exactly 10 digits.");
  return;
}

    if (!form.hsrp_number.trim()) {
      alert("HSRP number is required.");
      return;
    }
    if (!form.fitment_date) {
      alert("Fitment date is required.");
      return;
    }
    if (!String(form.amount_paid || "").trim()) {
      alert("Fitment amount is required.");
      return;
    }
    if (!String(form.fitment_by || "").trim()) {
      alert("Fitment by is required.");
      return;
    }

    try {
      setSaving(true);
      await api.post("/api/hsrp/old-fitment", form);
      alert("Old customer HSRP fitment saved successfully.");
      setForm({
        customer_name: "",
        mobile_number: "",
        hsrp_number: "",
        fitment_date: "",
        amount_paid: "",
        fitment_by: "",
        notes: "",
      });
      await load();
    } catch (e: any) {
      console.error("Old HSRP fitment save error", e);
      alert(e?.response?.data?.message || "Failed to save old customer fitment");
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

      const base = api.defaults.baseURL || "";
      const res = await fetch(`${base}/api/hsrp/old-fitment/export?${params.toString()}`, {
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
      a.download = "hsrp_old_customer_fitment_export.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "Export failed");
    }
  };

  return (
    <AuthGuard>
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/hsrp")}
              className="mb-3 px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50"
            >
              ← Back to HSRP
            </button>
            <h1 className="text-2xl font-bold">Old Vehicle HSRP Fitment</h1>
            <p className="text-sm text-gray-600">
              For old customers where no sale record is linked
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
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

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4">
          <h2 className="text-lg font-semibold mb-4">Add Old Customer Fitment</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <div className="text-sm mb-1">Customer Name</div>
              <input
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </label>

           <label className="block">
  <div className="text-sm mb-1">Mobile Number</div>
  <input
    value={form.mobile_number}
    maxLength={10}
    inputMode="numeric"
    pattern="[0-9]*"
    onChange={(e) =>
      setForm({
        ...form,
        mobile_number: e.target.value.replace(/\D/g, "").slice(0, 10),
      })
    }
    className="w-full border rounded-lg px-3 py-2"
  />
</label>

            <label className="block md:col-span-2">
              <div className="text-sm mb-1">HSRP Number</div>
              <input
                value={form.hsrp_number}
                onChange={(e) => setForm({ ...form, hsrp_number: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </label>

            <label className="block">
              <div className="text-sm mb-1">Fitment Date</div>
              <input
                type="date"
                value={form.fitment_date}
                onChange={(e) => setForm({ ...form, fitment_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </label>

            <label className="block">
              <div className="text-sm mb-1">Fitment Amount</div>
              <input
                type="number"
                value={form.amount_paid}
                onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
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
              <div className="text-sm mb-1">Notes</div>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 min-h-[100px]"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={save}
              disabled={saving || permissionsLoading || !canCreate}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search customer / mobile / HSRP no / fitment by"
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
          </div>

          <div className="mt-3">
            <button
              onClick={load}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-x-auto border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-3 text-left">ID</th>
                <th className="p-3 text-left">Customer</th>
                <th className="p-3 text-left">Mobile</th>
                <th className="p-3 text-left">HSRP No</th>
                <th className="p-3 text-center">Fitment Date</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-left">Fitment By</th>
                <th className="p-3 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="p-4 text-center">
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-gray-500">
                    No old customer HSRP fitment records found
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">{r.id}</td>
                    <td className="p-3 font-medium">{r.customer_name}</td>
                    <td className="p-3">{r.mobile_number || "-"}</td>
                    <td className="p-3">{r.hsrp_number}</td>
                    <td className="p-3 text-center">{fmtDate(r.fitment_date)}</td>
                    <td className="p-3 text-right">{r.amount_paid ?? "-"}</td>
                    <td className="p-3">{r.fitment_by_name || "-"}</td>
                    <td className="p-3">{r.notes || "-"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </AuthGuard>
  );
}