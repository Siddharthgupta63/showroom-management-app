"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";

type LogRow = {
  id: number;
  policy_id: number | null;
  phone: string;
  message: string;
  status: "sent" | "failed";
  error: string | null;
  created_at: string;

  customer_name?: string | null;
  policy_no?: string | null;
  vehicle_no?: string | null;
};

function Pill({
  children,
  bg,
  color = "#111",
}: {
  children: any;
  bg: string;
  color?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 10px",
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: "sent" | "failed" }) {
  return status === "sent" ? (
    <Pill bg="#16a34a" color="#fff">
      sent
    </Pill>
  ) : (
    <Pill bg="#dc2626" color="#fff">
      failed
    </Pill>
  );
}

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function safeStr(v: any) {
  return String(v ?? "").toLowerCase();
}

export default function WhatsAppLogsPage() {
  // Hydration-safe rendering for date formatting
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { permissions, loading } = usePermissions();

  const canView = !!permissions.view_whatsapp_logs;
  const canExport = !!permissions.export_whatsapp_logs;
  const canRetry = !!permissions.retry_whatsapp_logs;

  // filters (server)
  const [status, setStatus] = useState<"" | "sent" | "failed">("");
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState(""); // YYYY-MM-DD

  // filters (client)
  const [q, setQ] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [totalPages, setTotalPages] = useState(1);

  // data
  const [rows, setRows] = useState<LogRow[]>([]);
  const [errMsg, setErrMsg] = useState("");

  // summary
  const [sentToday, setSentToday] = useState(0);
  const [failedToday, setFailedToday] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [waEnabled, setWaEnabled] = useState(true);
  const [waFails, setWaFails] = useState(0);
  const [waReason, setWaReason] = useState<string | null>(null);

  // grouping UI
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fmtDateSafe = (s: string) => (mounted ? fmtDate(s) : "-");

  const fetchSummary = async () => {
    try {
      const res = await api.get("/api/whatsapp/logs/summary", {
        params: {
          from: from || undefined,
          to: to || undefined,
        },
      });

      setSentToday(Number(res.data?.sent || 0));
      setFailedToday(Number(res.data?.failed || 0));
      setSuccessRate(Number(res.data?.successRate || 0));

      const w = res.data?.whatsapp;
      if (w) {
        setWaEnabled(!!w.enabled);
        setWaFails(Number(w.consecutive_failures || 0));
        setWaReason(w.disabled_reason || null);
      }
    } catch {
      // ignore
    }
  };

  const fetchLogs = async () => {
    if (!canView) return;
    setErrMsg("");
    try {
      const res = await api.get("/api/whatsapp/logs", {
        params: {
          page,
          pageSize,
          status: status || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });

      setRows((res.data?.data || []) as LogRow[]);
      setTotalPages(Number(res.data?.totalPages || 1));

      const w = res.data?.whatsapp;
      if (w) {
        setWaEnabled(!!w.enabled);
        setWaFails(Number(w.consecutive_failures || 0));
        setWaReason(w.disabled_reason || null);
      }
    } catch (e: any) {
      setErrMsg(e?.response?.data?.message || e?.message || "Failed");
    }
  };

  useEffect(() => {
    if (loading) return;
    fetchLogs();
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, page]);

  useEffect(() => {
    if (loading) return;
    setPage(1);
    fetchLogs();
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, from, to]);

  const retry = async (id: number) => {
    if (!canRetry) return alert("Permission denied");
    try {
      await api.post(`/api/whatsapp/logs/${id}/retry`);
      await fetchLogs();
      await fetchSummary();
      alert("Retry done. Check latest row.");
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Retry failed");
    }
  };

  const exportCsv = async () => {
    if (!canExport) return alert("Permission denied");

    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);

      const resp = await fetch(
        `/api/whatsapp/logs/export?${qs.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );

      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || `Export failed (${resp.status})`);
      }

      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `whatsapp_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "Export failed");
    }
  };

  const titleRange = useMemo(() => {
    if (from || to) return `(${from || "…"} to ${to || "…"})`;
    return "(Today)";
  }, [from, to]);

  // ✅ Group rows by Policy + Phone (keeps history)
  type Group = {
    key: string;
    policy_id: number | null;
    policy_no: string;
    customer_name: string;
    vehicle_no: string;
    phone: string;
    latest: LogRow;
    attempts: LogRow[];
  };

  const groups = useMemo(() => {
    const qq = safeStr(q).trim();
    const filtered = !qq
      ? rows
      : rows.filter((r) => {
          const hay =
            safeStr(r.policy_no) +
            " " +
            safeStr(r.customer_name) +
            " " +
            safeStr(r.vehicle_no) +
            " " +
            safeStr(r.phone) +
            " " +
            safeStr(r.message) +
            " " +
            safeStr(r.error);
          return hay.includes(qq);
        });

    const map = new Map<string, Group>();

    for (const r of filtered) {
      const policyPart = String(r.policy_id ?? r.policy_no ?? "no-policy");
      const key = `${policyPart}::${r.phone}`;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          policy_id: r.policy_id ?? null,
          policy_no: r.policy_no || "-",
          customer_name: r.customer_name || "-",
          vehicle_no: r.vehicle_no || "-",
          phone: r.phone,
          latest: r,
          attempts: [r],
        });
      } else {
        existing.attempts.push(r);
        if (r.id > existing.latest.id) existing.latest = r;
      }
    }

    const arr = Array.from(map.values()).map((g) => {
      g.attempts.sort((a, b) => b.id - a.id);
      return g;
    });

    arr.sort((a, b) => b.latest.id - a.latest.id);
    return arr;
  }, [rows, q]);

  const toggleGroup = (k: string) => {
    setExpanded((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!canView) return <div style={{ padding: 20 }}>Permission denied</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>
              📩 WhatsApp Reminder Logs
            </h2>
            <Pill bg="#f3f4f6">Filters {titleRange}</Pill>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={btnOutline}
              onClick={() => {
                setStatus("");
                setFrom("");
                setTo("");
                setQ("");
              }}
            >
              Reset Filters
            </button>
            <button
              style={btnOutline}
              onClick={exportCsv}
              disabled={!canExport}
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
            gap: 10,
            marginTop: 12,
          }}
        >
          <div style={kpiCard}>
            <div style={kpiLabel}>Sent</div>
            <div style={kpiValue}>{sentToday}</div>
          </div>
          <div style={kpiCard}>
            <div style={kpiLabel}>Failed</div>
            <div style={kpiValue}>{failedToday}</div>
          </div>
          <div style={kpiCard}>
            <div style={kpiLabel}>Success Rate</div>
            <div style={kpiValue}>{successRate}%</div>
          </div>
          <div style={kpiCard}>
            <div style={kpiLabel}>WhatsApp Status</div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {waEnabled ? (
                <Pill bg="#dcfce7" color="#166534">
                  Enabled
                </Pill>
              ) : (
                <Pill bg="#fee2e2" color="#991b1b">
                  Disabled
                </Pill>
              )}
              <Pill bg="#f3f4f6">Fails: {waFails}</Pill>
              {waReason ? (
                <span
                  style={{
                    fontSize: 12,
                    color: "#991b1b",
                    fontWeight: 800,
                  }}
                >
                  {waReason}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 12,
            alignItems: "center",
          }}
        >
          <select
            style={input}
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="">All</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={label}>From</span>
            <input
              style={input}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={label}>To</span>
            <input
              style={input}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <input
            style={{ ...input, minWidth: 260 }}
            placeholder="Search policy / phone / customer / vehicle / message"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {errMsg && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 10,
              background: "#fee2e2",
              color: "#991b1b",
              fontWeight: 700,
            }}
          >
            API Error: {errMsg}
          </div>
        )}
      </div>

      {/* Grouped Table */}
      <div style={{ ...card, marginTop: 12, overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
          }}
        >
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {[
                "Group",
                "Customer",
                "Policy",
                "Vehicle",
                "Phone",
                "Latest Message",
                "Latest Status",
                "Attempts",
                "Action",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "12px 12px",
                    fontSize: 12,
                    color: "#374151",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {groups.map((g) => {
              const isOpen = !!expanded[g.key];
              const latest = g.latest;
              const latestFailed = latest.status === "failed";

              return (
                <Fragment key={g.key}>
                  {/* Group Row */}
                  <tr style={{ background: isOpen ? "#fcfcfd" : "#fff" }}>
                    <td style={td}>
                      <button
                        style={btnOutlineSmall}
                        onClick={() => toggleGroup(g.key)}
                      >
                        {isOpen ? "−" : "+"} {fmtDateSafe(latest.created_at)}
                      </button>
                    </td>

                    <td style={td}>{g.customer_name}</td>
                    <td style={{ ...td, fontWeight: 900 }}>{g.policy_no}</td>
                    <td style={td}>{g.vehicle_no}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 800 }}>
                      {g.phone}
                    </td>

                    <td style={td}>
                      <div style={{ maxWidth: 520, whiteSpace: "pre-wrap" }}>
                        {latest.message}
                      </div>
                      {latest.error ? (
                        <div
                          style={{
                            marginTop: 6,
                            color: "#dc2626",
                            fontWeight: 800,
                            fontSize: 12,
                          }}
                        >
                          {latest.error}
                        </div>
                      ) : null}
                    </td>

                    <td style={td}>
                      <StatusPill status={latest.status} />
                    </td>

                    <td style={td}>
                      <Pill bg="#f3f4f6">{g.attempts.length} tries</Pill>
                    </td>

                    <td style={td}>
                      {latestFailed ? (
                        <button
                          style={btnPrimarySmall}
                          onClick={() => retry(latest.id)}
                          disabled={!canRetry}
                          title="Retry latest failed attempt"
                        >
                          Retry Latest
                        </button>
                      ) : (
                        <span style={{ color: "#6b7280", fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded attempts */}
                  {isOpen ? (
                    <tr>
                      <td colSpan={9} style={{ padding: 0 }}>
                        <div style={{ padding: 12, borderTop: "1px solid #eee" }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              color: "#374151",
                              marginBottom: 10,
                            }}
                          >
                            Attempts (newest first)
                          </div>

                          <table
                            style={{ width: "100%", borderCollapse: "collapse" }}
                          >
                            <thead>
                              <tr style={{ background: "#f9fafb" }}>
                                {["Time", "Status", "Error", "Action"].map(
                                  (h) => (
                                    <th
                                      key={h}
                                      style={{
                                        textAlign: "left",
                                        padding: "10px 10px",
                                        fontSize: 12,
                                        color: "#374151",
                                        borderBottom: "1px solid #eee",
                                      }}
                                    >
                                      {h}
                                    </th>
                                  )
                                )}
                              </tr>
                            </thead>

                            <tbody>
                              {g.attempts.map((a) => (
                                <tr key={`${g.key}-${a.id}`}>
                                  <td style={tdSmall}>{fmtDateSafe(a.created_at)}</td>
                                  <td style={tdSmall}>
                                    <StatusPill status={a.status} />
                                  </td>
                                  <td
                                    style={{
                                      ...tdSmall,
                                      color:
                                        a.status === "failed"
                                          ? "#dc2626"
                                          : "#6b7280",
                                      fontWeight: 800,
                                    }}
                                  >
                                    {a.error || "-"}
                                  </td>
                                  <td style={tdSmall}>
                                    {a.status === "failed" ? (
                                      <button
                                        style={btnOutlineSmall}
                                        onClick={() => retry(a.id)}
                                        disabled={!canRetry}
                                      >
                                        Retry This
                                      </button>
                                    ) : (
                                      <span
                                        style={{
                                          color: "#6b7280",
                                          fontSize: 12,
                                        }}
                                      >
                                        —
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}

            {!groups.length && (
              <tr>
                <td colSpan={9} style={{ padding: 20, color: "#6b7280" }}>
                  No logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 12,
            borderTop: "1px solid #eee",
          }}
        >
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Page <b>{page}</b> / {totalPages}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={btnOutlineSmall}
              disabled={page <= 1}
              onClick={() => setPage(1)}
            >
              First
            </button>
            <button
              style={btnOutlineSmall}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button
              style={btnOutlineSmall}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
            <button
              style={btnOutlineSmall}
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
            >
              Last
            </button>
          </div>
        </div>
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

const td: any = {
  padding: "12px 12px",
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "top",
};

const tdSmall: any = {
  padding: "10px 10px",
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "top",
  fontSize: 13,
};

const btnOutline: any = {
  height: 38,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};

const btnOutlineSmall: any = {
  height: 30,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 12,
};

const btnPrimarySmall: any = {
  height: 32,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #dc2626",
  background: "#dc2626",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 12,
};

const kpiCard: any = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
};

const kpiLabel: any = { fontSize: 12, color: "#6b7280", fontWeight: 900 };
const kpiValue: any = { fontSize: 22, fontWeight: 950, marginTop: 4 };
