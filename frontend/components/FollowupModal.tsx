"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

type FollowupLog = {
  id: number;
  source: "SALE" | "DIRECT" | "RENEWAL";
  source_id: number;
  followup_date: string;
  remark: string | null;
  disposition: "INTERESTED" | "CALL_BACK" | "NO_RESPONSE" | "RENEWED" | "NOT_INTERESTED";
  next_followup_date: string | null;
  created_by_name?: string | null;
  created_at?: string | null;
};

const DISPOSITIONS = [
  { value: "INTERESTED", label: "Interested" },
  { value: "CALL_BACK", label: "Call Back" },
  { value: "NO_RESPONSE", label: "No Response" },
  { value: "RENEWED", label: "Renewed" },
  { value: "NOT_INTERESTED", label: "Not Interested" },
];

export default function FollowupModal({
  open,
  onClose,
  row,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  row: any | null;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<FollowupLog[]>([]);

  const [followupDate, setFollowupDate] = useState("");
  const [remark, setRemark] = useState("");
  const [disposition, setDisposition] = useState("CALL_BACK");
  const [nextFollowupDate, setNextFollowupDate] = useState("");

  useEffect(() => {
    if (!open || !row) return;
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row]);

  async function loadLogs() {
    if (!row) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/insurance-followup/${row.source}/${row.id}`);
      setLogs(res.data?.data || []);
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Failed to load follow-ups");
    } finally {
      setLoading(false);
    }
  }

  async function saveFollowup() {
    if (!row) return;
    if (!followupDate) {
      alert("Please select follow-up date");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/api/insurance-followup`, {
        source: row.source,
        source_id: row.id,
        followup_date: followupDate,
        remark: remark || null,
        disposition,
        next_followup_date: nextFollowupDate || null,
      });

      setFollowupDate("");
      setRemark("");
      setDisposition("CALL_BACK");
      setNextFollowupDate("");
      await loadLogs();
      onSaved();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog(id: number) {
    if (!confirm("Delete this follow-up?")) return;
    try {
      await api.delete(`/api/insurance-followup/${id}`);
      await loadLogs();
      onSaved();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Delete failed");
    }
  }

  if (!open || !row) return null;

  const phone = String(row.phone || "").replace(/\D/g, "").slice(0, 10);

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={topbar}>
          <div>
            <h3 style={{ margin: 0 }}>CRM Follow-up Timeline</h3>
            <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
              Manage customer communication and renewal tracking
            </div>
          </div>
          <button style={btnOutline} onClick={onClose}>X</button>
        </div>

        <div style={metaCard}>
          <div style={metaHeaderRow}>
            <div>
              <div style={metaCustomer}>{row.customer_name || "-"}</div>
              <div style={metaSub}>
                {row.phone || "-"} • {row.vehicle_no || "-"} • {row.company || "-"}
              </div>
            </div>
            <div style={sourcePill}>{row.source}</div>
          </div>

          <div style={metaGrid}>
            <div style={metaItem}>
              <div style={metaLabel}>Policy No</div>
              <div style={metaValue}>{row.policy_no || "-"}</div>
            </div>
            <div style={metaItem}>
              <div style={metaLabel}>Start Date</div>
              <div style={metaValue}>{fmtDate(row.start_date)}</div>
            </div>
            <div style={metaItem}>
              <div style={metaLabel}>Expiry Date</div>
              <div style={metaValue}>{fmtDate(row.expiry_date)}</div>
            </div>
            <div style={metaItem}>
              <div style={metaLabel}>Record ID</div>
              <div style={metaValue}>{row.id}</div>
            </div>
          </div>

          <div style={quickActions}>
            <a href={`tel:${phone}`} style={quickBtn}>Call</a>
            <a
              href={`https://wa.me/91${phone}`}
              target="_blank"
              rel="noreferrer"
              style={quickBtn}
            >
              WhatsApp
            </a>
            <button
              type="button"
              style={quickBtn}
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 3);
                setNextFollowupDate(d.toISOString().slice(0, 10));
              }}
            >
              Next in 3 Days
            </button>
            <button
              type="button"
              style={quickBtn}
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 7);
                setNextFollowupDate(d.toISOString().slice(0, 10));
              }}
            >
              Next in 7 Days
            </button>
          </div>
        </div>

        <div style={formCard}>
          <div style={sectionTitle}>Add Follow-up</div>

          <div style={grid}>
            <div>
              <div style={label}>Follow-up Date</div>
              <input
                style={input}
                type="date"
                value={followupDate}
                onChange={(e) => setFollowupDate(e.target.value)}
              />
            </div>

            <div>
              <div style={label}>Disposition</div>
              <select
                style={input}
                value={disposition}
                onChange={(e) => setDisposition(e.target.value)}
              >
                {DISPOSITIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={label}>Next Follow-up Date</div>
              <input
                style={input}
                type="date"
                value={nextFollowupDate}
                onChange={(e) => setNextFollowupDate(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={label}>Remark</div>
              <textarea
                style={textarea}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Write note / customer response..."
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button style={btnPrimary} disabled={saving} onClick={saveFollowup}>
              {saving ? "Saving..." : "Add Follow-up"}
            </button>
          </div>
        </div>

        <div style={timelineCard}>
          <div style={sectionTitle}>Timeline</div>

          {loading ? (
            <div>Loading...</div>
          ) : logs.length === 0 ? (
            <div style={{ color: "#666" }}>No follow-up history yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {logs.map((log) => (
                <div key={log.id} style={timelineItem}>
                  <div style={timelineHeader}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={pill(log.disposition)}>{labelOf(log.disposition)}</span>
                      <span><b>Date:</b> {fmtDate(log.followup_date)}</span>
                      {log.next_followup_date ? (
                        <span><b>Next:</b> {fmtDate(log.next_followup_date)}</span>
                      ) : null}
                    </div>

                    <button style={btnDanger} onClick={() => deleteLog(log.id)}>
                      Delete
                    </button>
                  </div>

                  <div style={{ marginTop: 8, color: "#222", whiteSpace: "pre-wrap" }}>
                    {log.remark || "-"}
                  </div>

                  <div style={smallMuted}>
                    {log.created_by_name ? `By: ${log.created_by_name}` : "By: System"}
                    {log.created_at ? ` • ${String(log.created_at).slice(0, 19).replace("T", " ")}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button style={btnOutline} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function labelOf(v: string) {
  return DISPOSITIONS.find((x) => x.value === v)?.label || v;
}

function fmtDate(v?: string | null) {
  if (!v) return "-";
  return String(v).slice(0, 10);
}

function pill(disposition: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    INTERESTED: { background: "#dcfce7", color: "#166534" },
    CALL_BACK: { background: "#dbeafe", color: "#1d4ed8" },
    NO_RESPONSE: { background: "#fef3c7", color: "#92400e" },
    RENEWED: { background: "#e9d5ff", color: "#6b21a8" },
    NOT_INTERESTED: { background: "#fee2e2", color: "#991b1b" },
  };
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 12,
    ...(map[disposition] || { background: "#eee", color: "#111" }),
  };
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 12,
  zIndex: 9999,
};

const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  width: 900,
  maxWidth: "100%",
  maxHeight: "90vh",
  overflow: "auto",
  padding: 16,
  border: "1px solid #eee",
};

const topbar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 12,
  gap: 12,
};

const metaCard: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 12,
  background: "#fafafa",
  display: "grid",
  gap: 10,
  marginBottom: 12,
};

const metaHeaderRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const metaCustomer: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 20,
  color: "#111827",
};

const metaSub: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  marginTop: 4,
};

const sourcePill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "#eef2ff",
  color: "#3730a3",
  fontWeight: 800,
  fontSize: 12,
};

const metaGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0,1fr))",
  gap: 10,
};

const metaItem: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 10,
};

const metaLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  fontWeight: 700,
  textTransform: "uppercase",
  marginBottom: 4,
};

const metaValue: React.CSSProperties = {
  fontSize: 14,
  color: "#111827",
  fontWeight: 700,
};

const quickActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const quickBtn: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  padding: "8px 12px",
  borderRadius: 10,
  cursor: "pointer",
  textDecoration: "none",
  color: "#111827",
  fontWeight: 700,
  fontSize: 13,
};

const formCard: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
  marginBottom: 12,
};

const timelineCard: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 12,
  background: "#fafafa",
};

const timelineItem: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#fff",
  padding: 12,
};

const timelineHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: 10,
  fontSize: 16,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0,1fr))",
  gap: 12,
};

const label: React.CSSProperties = {
  fontSize: 12,
  color: "#555",
  marginBottom: 6,
};

const input: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "10px 12px",
  width: "100%",
  outline: "none",
};

const textarea: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "10px 12px",
  width: "100%",
  minHeight: 90,
  outline: "none",
  resize: "vertical",
};

const btnOutline: React.CSSProperties = {
  border: "1px solid #ccc",
  background: "#fff",
  padding: "8px 12px",
  borderRadius: 10,
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  border: "1px solid #dc2626",
  background: "#dc2626",
  color: "#fff",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const btnDanger: React.CSSProperties = {
  border: "1px solid #ef4444",
  background: "#fff",
  color: "#dc2626",
  padding: "6px 10px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
};

const smallMuted: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  color: "#666",
};