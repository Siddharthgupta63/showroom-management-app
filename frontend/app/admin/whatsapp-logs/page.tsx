"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

type Row = {
  id: number;
  policy_id: number | null;
  phone: string;
  message: string;
  status: "sent" | "failed";
  error: string | null;
  created_at: string;

  policy_no?: string | null;
  customer_name?: string | null;
  vehicle_no?: string | null;
  expiry_date?: string | null;
};

export default function WhatsappLogsPage() {
  const user = getUser();
  const role = String(user?.role || "").toLowerCase();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  const [status, setStatus] = useState<"" | "sent" | "failed">("");
  const [phone, setPhone] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async () => {
    setLoading(true);
    setErrMsg("");
    try {
      const res = await api.get("/api/admin/whatsapp-reminders", {
        params: {
          page,
          pageSize: 20,
          status: status || undefined,
          phone: phone.trim() || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });

      setRows(res.data?.data || []);
      setTotalPages(Number(res.data?.totalPages || 1));
    } catch (e: any) {
      setErrMsg(e?.response?.data?.message || e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // reset to page 1 and reload when filters change
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      fetchLogs();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, phone, from, to]);

  if (role !== "owner" && role !== "admin") {
    return <div style={{ padding: 20 }}>Permission denied</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>WhatsApp Logs</h2>
            <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
              Shows reminders from <b>whatsapp_reminders</b>
            </div>
          </div>

          <button style={btnOutline} onClick={fetchLogs}>
            Refresh
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <select style={input} value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="">All Status</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>

          <input
            style={input}
            placeholder="Search phone..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={label}>From</span>
            <input style={input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={label}>To</span>
            <input style={input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {errMsg && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "#fee2e2", color: "#991b1b", fontWeight: 700 }}>
            {errMsg}
          </div>
        )}
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        {loading ? (
          <div style={{ padding: 16 }}>Loading...</div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["ID", "Status", "Created", "Phone", "Policy", "Customer", "Vehicle", "Expiry", "Error"].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={td}>{r.id}</td>
                      <td style={td}>
                        <span style={pill(r.status === "sent" ? "#16a34a" : "#dc2626")}>{r.status}</span>
                      </td>
                      <td style={td}>{String(r.created_at).replace("T", " ").slice(0, 19)}</td>
                      <td style={td} className="mono">{r.phone}</td>
                      <td style={td}>{r.policy_no || "-"}</td>
                      <td style={td}>{r.customer_name || "-"}</td>
                      <td style={td}>{r.vehicle_no || "-"}</td>
                      <td style={td}>{r.expiry_date || "-"}</td>
                      <td style={{ ...td, maxWidth: 340, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.error || "-"}
                      </td>
                    </tr>
                  ))}

                  {!rows.length && (
                    <tr>
                      <td colSpan={9} style={{ padding: 16, color: "#6b7280" }}>
                        No logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                Page <b>{page}</b> / {totalPages}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button style={btnOutlineSmall} disabled={page <= 1} onClick={() => setPage(1)}>First</button>
                <button style={btnOutlineSmall} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
                <button style={btnOutlineSmall} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
                <button style={btnOutlineSmall} disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* styles */
const card: any = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 14,
  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
};

const input: any = {
  height: 38,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  outline: "none",
  fontSize: 14,
};

const label: any = { fontSize: 12, color: "#6b7280", fontWeight: 800 };

const th: any = {
  textAlign: "left",
  padding: "12px 12px",
  fontSize: 12,
  color: "#374151",
  borderBottom: "1px solid #eee",
};

const td: any = {
  padding: "12px 12px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
  fontSize: 13,
};

const btnOutline: any = {
  height: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const btnOutlineSmall: any = {
  height: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const pill = (bg: string) =>
  ({
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    background: bg,
    color: "#fff",
    fontSize: 12,
    fontWeight: 900,
  } as any);
