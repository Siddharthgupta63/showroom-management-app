"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

type RCRecord = {
  sale_id: number;
  customer_name: string;
  mobile_number: string;
  vehicle_model: string;
  sale_date?: string;
  rc_number?: string;
  rc_issued_date?: string;
  file_prepared: number;
  file_prepared_date?: string;
  file_sent_to_agent: number;
  file_sent_to_agent_date?: string;
  agent_name?: string;
  rc_received_from_agent: number;
  rc_received_from_agent_date?: string;
  rc_card_delivered: number;
  rc_delivered_date?: string;
  notes?: string;
  status: string;
};

type AgentOption = {
  value: string;
  label?: string;
};

type FormState = {
  sale_id: number;
  rc_number: string;
  rc_issued_date: string;
  file_prepared: number;
  file_prepared_date: string;
  file_sent_to_agent: number;
  file_sent_to_agent_date: string;
  agent_name: string;
  rc_received_from_agent: number;
  rc_received_from_agent_date: string;
  rc_card_delivered: number;
  rc_delivered_date: string;
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
  if (s.includes("delivered")) return "bg-green-100 text-green-800";
  return "bg-orange-100 text-orange-800";
}

function normalizeAgentOptions(payload: any): AgentOption[] {
  const grouped = payload?.data?.rc_agent;
  const raw =
    Array.isArray(grouped) ? grouped :
    Array.isArray(payload) ? payload :
    Array.isArray(payload?.data) ? payload.data :
    Array.isArray(payload?.rows) ? payload.rows :
    Array.isArray(payload?.items) ? payload.items :
    [];

  return raw
    .map((item: any) => {
      if (typeof item === "string") {
        return { value: item, label: item };
      }
      return {
        value: String(item?.value ?? item?.label ?? item?.name ?? "").trim(),
        label: String(item?.label ?? item?.value ?? item?.name ?? "").trim(),
      };
    })
    .filter((x: AgentOption) => x.value);
}

export default function RCPage() {
  const [records, setRecords] = useState<RCRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([]);

  const load = async () => {
    try {
      setLoading(true);

      const [rcRes, agentRes] = await Promise.all([
        api.get("/api/rc"),
        api.get("/api/dropdowns", { params: { types: "rc_agent" } }),
      ]);

      setRecords(Array.isArray(rcRes.data) ? rcRes.data : []);
      setAgentOptions(normalizeAgentOptions(agentRes.data));
    } catch (e) {
      console.error("RC load error", e);
      setRecords([]);
      setAgentOptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
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
          r.rc_number || "",
          r.agent_name || "",
          String(r.sale_id),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)
      );
    }

    return data;
  }, [records, filter, q]);

  const openEdit = (r: RCRecord) => {
    setForm({
      sale_id: r.sale_id,
      rc_number: r.rc_number || "",
      rc_issued_date: r.rc_issued_date ? String(r.rc_issued_date).slice(0, 10) : "",
      file_prepared: Number(r.file_prepared || 0),
      file_prepared_date: r.file_prepared_date ? String(r.file_prepared_date).slice(0, 10) : "",
      file_sent_to_agent: Number(r.file_sent_to_agent || 0),
      file_sent_to_agent_date: r.file_sent_to_agent_date ? String(r.file_sent_to_agent_date).slice(0, 10) : "",
      agent_name: r.agent_name || "",
      rc_received_from_agent: Number(r.rc_received_from_agent || 0),
      rc_received_from_agent_date: r.rc_received_from_agent_date ? String(r.rc_received_from_agent_date).slice(0, 10) : "",
      rc_card_delivered: Number(r.rc_card_delivered || 0),
      rc_delivered_date: r.rc_delivered_date ? String(r.rc_delivered_date).slice(0, 10) : "",
      notes: r.notes || "",
    });
  };

  const save = async () => {
    if (!form) return;

    if (form.file_prepared === 1 && !form.file_prepared_date) {
      alert("File prepared date is required.");
      return;
    }

    if (form.file_sent_to_agent === 1 && form.file_prepared !== 1) {
      alert("Cannot send file to agent before file preparation.");
      return;
    }

    if (form.file_sent_to_agent === 1 && !form.file_sent_to_agent_date) {
      alert("Sent date is required.");
      return;
    }

    if (form.file_sent_to_agent === 1 && !form.agent_name.trim()) {
      alert("Agent name is required.");
      return;
    }

    if (form.rc_received_from_agent === 1 && form.file_sent_to_agent !== 1) {
      alert("Cannot mark RC received before sending to agent.");
      return;
    }

    if (form.rc_received_from_agent === 1 && !form.rc_received_from_agent_date) {
      alert("RC received date is required.");
      return;
    }

    if (form.rc_card_delivered === 1 && form.rc_received_from_agent !== 1) {
      alert("Cannot deliver RC before receiving RC from agent.");
      return;
    }

    if (form.rc_card_delivered === 1 && !form.rc_delivered_date) {
      alert("Delivered date is required.");
      return;
    }

    try {
      setSaving(true);
      await api.put(`/api/rc/${form.sale_id}`, form);
      setForm(null);
      await load();
    } catch (e: any) {
      console.error("RC save error", e);
      alert(e?.response?.data?.message || "Failed to save RC");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">RC</h1>
          <p className="text-sm text-gray-600">
            File Prepare → Send To Agent → Receive RC → Deliver To Customer
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 mb-4 border border-slate-200">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search customer / mobile / vehicle / RC no / agent / sale id"
              className="flex-1 min-w-[240px] border border-slate-300 rounded-lg px-3 py-2"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2"
            >
              <option value="all">All</option>
              <option value="File Preparation Pending">File Preparation Pending</option>
              <option value="File Ready">File Ready</option>
              <option value="Sent To Agent">Sent To Agent</option>
              <option value="RC Received">RC Received</option>
              <option value="Delivered">Delivered</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-x-auto border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-3 text-left">Sale ID</th>
                <th className="p-3 text-left">Customer</th>
                <th className="p-3 text-left">Vehicle</th>
                <th className="p-3 text-center">File Prepared</th>
                <th className="p-3 text-center">Sent To Agent</th>
                <th className="p-3 text-center">RC Received</th>
                <th className="p-3 text-center">Delivered</th>
                <th className="p-3 text-left">RC No</th>
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
                    No RC records found
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((r) => (
                  <tr key={r.sale_id} className="border-t hover:bg-gray-50">
                    <td className="p-3">{r.sale_id}</td>
                    <td className="p-3 font-medium">{r.customer_name}</td>
                    <td className="p-3">{r.vehicle_model}</td>
                    <td className="p-3 text-center">
                      {r.file_prepared ? fmtDate(r.file_prepared_date) : "NO"}
                    </td>
                    <td className="p-3 text-center">
                      {r.file_sent_to_agent
                        ? `${fmtDate(r.file_sent_to_agent_date)}${r.agent_name ? ` (${r.agent_name})` : ""}`
                        : "NO"}
                    </td>
                    <td className="p-3 text-center">
                      {r.rc_received_from_agent ? fmtDate(r.rc_received_from_agent_date) : "NO"}
                    </td>
                    <td className="p-3 text-center">
                      {r.rc_card_delivered ? fmtDate(r.rc_delivered_date) : "NO"}
                    </td>
                    <td className="p-3">{r.rc_number || "-"}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass(r.status)}`}>
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
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-5">
              <div className="text-xl font-bold mb-4">Update RC – Sale #{form.sale_id}</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <div className="text-sm mb-1">RC Number</div>
                  <input
                    value={form.rc_number}
                    readOnly
                    className="w-full border rounded-lg px-3 py-2 bg-slate-100"
                  />
                </label>

                <label className="block">
                  <div className="text-sm mb-1">RC Issued Date</div>
                  <input
                    type="date"
                    value={form.rc_issued_date}
                    onChange={(e) => setForm({ ...form, rc_issued_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </label>

                <label className="block">
                  <div className="text-sm mb-1">File Prepared</div>
                  <select
                    value={form.file_prepared}
                    onChange={(e) => setForm({ ...form, file_prepared: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value={0}>No</option>
                    <option value={1}>Yes</option>
                  </select>
                </label>

                <label className="block">
                  <div className="text-sm mb-1">File Prepared Date</div>
                  <input
                    type="date"
                    value={form.file_prepared_date}
                    onChange={(e) => setForm({ ...form, file_prepared_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </label>

                <label className="block">
                  <div className="text-sm mb-1">Sent To Agent</div>
                  <select
                    value={form.file_sent_to_agent}
                    onChange={(e) => setForm({ ...form, file_sent_to_agent: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value={0}>No</option>
                    <option value={1}>Yes</option>
                  </select>
                </label>

                <label className="block">
                  <div className="text-sm mb-1">Sent Date</div>
                  <input
                    type="date"
                    value={form.file_sent_to_agent_date}
                    onChange={(e) => setForm({ ...form, file_sent_to_agent_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </label>

                <label className="block">
                  <div className="text-sm mb-1">Agent Name</div>
                  <select
                    value={form.agent_name}
                    onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select Agent</option>
                    {Array.isArray(agentOptions) &&
                      agentOptions.map((o, idx) => (
                        <option key={idx} value={o.value}>
                          {o.label || o.value}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="block">
                  <div className="text-sm mb-1">RC Received From Agent</div>
                  <select
                    value={form.rc_received_from_agent}
                    onChange={(e) => setForm({ ...form, rc_received_from_agent: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value={0}>No</option>
                    <option value={1}>Yes</option>
                  </select>
                </label>

                <label className="block">
                  <div className="text-sm mb-1">RC Received Date</div>
                  <input
                    type="date"
                    value={form.rc_received_from_agent_date}
                    onChange={(e) => setForm({ ...form, rc_received_from_agent_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </label>

                <label className="block">
                  <div className="text-sm mb-1">Delivered To Customer</div>
                  <select
                    value={form.rc_card_delivered}
                    onChange={(e) => setForm({ ...form, rc_card_delivered: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value={0}>No</option>
                    <option value={1}>Yes</option>
                  </select>
                </label>

                <label className="block">
                  <div className="text-sm mb-1">Delivered Date</div>
                  <input
                    type="date"
                    value={form.rc_delivered_date}
                    onChange={(e) => setForm({ ...form, rc_delivered_date: e.target.value })}
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