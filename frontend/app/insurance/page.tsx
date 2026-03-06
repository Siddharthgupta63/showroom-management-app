"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { getUser } from "@/lib/auth";
import OwnerImportExportButtons from "@/components/OwnerImportExportButtons";

function getRoleFromToken(): string | null {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload?.role ? String(payload.role) : null;
  } catch {
    return null;
  }
}


type Row = {
  source: "SALE" | "RENEWAL";
  id: number;
  sale_id: number | null;

  policy_no: string;
  customer_name: string;
  phone: string;

  vehicle_no: string;
  model_name: string | null;

  chassis_number: string | null;
  engine_number: string | null;

  company: string;
  start_date: string;
  expiry_date: string;

  days_left: number;
  status_color: "black" | "red" | "orange" | "green";

  followup1_date?: string | null;
  followup1_remark?: string | null;
  followup2_date?: string | null;
  followup2_remark?: string | null;
  followup3_date?: string | null;
  followup3_remark?: string | null;
};

const phone10 = (v: any) => String(v ?? "").replace(/\D/g, "").slice(0, 10);

// ✅ keep YYYY-MM-DD stable (no timezone surprises)
const toYYYYMMDD = (v: any) => {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// ✅ Expiry = start + 1 year - 1 day  (UTC safe)
function calcExpiry(startYYYYMMDD: string) {
  if (!startYYYYMMDD) return "";
  const d = new Date(`${startYYYYMMDD}T00:00:00Z`);
  if (isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear() + 1;
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const plus1y = new Date(Date.UTC(y, m, day));
  const minus1 = new Date(plus1y.getTime() - 24 * 60 * 60 * 1000);
  const yy = minus1.getUTCFullYear();
  const mm = String(minus1.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(minus1.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

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
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function StatusBadge({ daysLeft, color }: { daysLeft: number; color: Row["status_color"] }) {
  const bg =
    color === "black"
      ? "#111"
      : color === "red"
      ? "#dc2626"
      : color === "orange"
      ? "#f59e0b"
      : "#16a34a";

  const label = daysLeft < 0 ? "Expired" : daysLeft === 0 ? "Today" : `${daysLeft} day(s) left`;
  return <Pill bg={bg} color="#fff">{label}</Pill>;
}

export default function InsurancePage() {
  const { permissions, loading } = usePermissions();

  const [user, setUser] = useState<any>(null);

useEffect(() => {
  const u = getUser();
  const roleFromToken = getRoleFromToken();

  // If getUser failed, still make role available
  if (!u && roleFromToken) {
    setUser({ role: roleFromToken });
  } else if (u && !u.role && roleFromToken) {
    setUser({ ...u, role: roleFromToken });
  } else {
    setUser(u);
  }

  console.log("INSURANCE getUser():", u, "roleFromToken:", roleFromToken);
}, []);





  const canView = !!permissions.view_insurance;
  const canRenew = !!permissions.renew_policy;

  // filters
  const [sourceFilter, setSourceFilter] = useState<"all" | "SALE" | "RENEWAL">("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // status buttons
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expiring" | "expired">("all");

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [totalPages, setTotalPages] = useState(1);

  const [rows, setRows] = useState<Row[]>([]);
  const [errMsg, setErrMsg] = useState("");

  // ✅ Renew modal state (INSIDE component only)
  const [showRenew, setShowRenew] = useState(false);
  const [renewRow, setRenewRow] = useState<Row | null>(null);
  const [renewStart, setRenewStart] = useState("");
  const [renewPhone, setRenewPhone] = useState("");
  const [renewPremium, setRenewPremium] = useState("");
  const renewExpiry = useMemo(() => calcExpiry(renewStart), [renewStart]);
  const [savingRenew, setSavingRenew] = useState(false);

  // followup modal
  const [showFollowup, setShowFollowup] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);

  const [f1d, setF1d] = useState(""); const [f1r, setF1r] = useState("");
  const [f2d, setF2d] = useState(""); const [f2r, setF2r] = useState("");
  const [f3d, setF3d] = useState(""); const [f3r, setF3r] = useState("");

  const fetchData = async () => {
    if (!canView) return;
    setErrMsg("");

    try {
      const res = await api.get("/api/insurance-combined", {
        params: {
          page,
          pageSize,
          source: sourceFilter,
          search: search.trim() || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });

      const list = (res.data?.data || []) as any[];

      const normalized: Row[] = list.map((r) => ({
        source: r.source,
        id: Number(r.id),
        sale_id: r.sale_id === null ? null : Number(r.sale_id),

        policy_no: String(r.policy_no ?? ""),
        customer_name: String(r.customer_name ?? ""),
        phone: phone10(r.phone),

        vehicle_no: String(r.vehicle_no ?? ""),
        model_name: r.model_name ?? null,

        chassis_number: r.chassis_number ?? null,
        engine_number: r.engine_number ?? null,

        company: String(r.company ?? ""),
        start_date: toYYYYMMDD(r.start_date),
        expiry_date: toYYYYMMDD(r.expiry_date),

        days_left: Number(r.days_left ?? 999999),
        status_color: r.status_color,

        followup1_date: r.followup1_date ?? null,
        followup1_remark: r.followup1_remark ?? null,
        followup2_date: r.followup2_date ?? null,
        followup2_remark: r.followup2_remark ?? null,
        followup3_date: r.followup3_date ?? null,
        followup3_remark: r.followup3_remark ?? null,
      }));

      setRows(normalized);
      setTotalPages(Number(res.data?.totalPages || 1));
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Request failed";
      setErrMsg(msg);
      console.error("insurance-combined error:", e);
    }
  };

  useEffect(() => {
    if (loading) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, page, sourceFilter, from, to]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      setPage(1);
      fetchData();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ✅ filter rows BEFORE rendering (your requested logic)
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const d = Number(r.days_left);

      if (statusFilter === "expired") return d < 0;
      if (statusFilter === "expiring") return d >= 0 && d <= 10;
      if (statusFilter === "active") return d > 10;
      return true;
    });
  }, [rows, statusFilter]);

  const openFollowup = (row: Row) => {
    setSelected(row);
    setF1d(row.followup1_date ? toYYYYMMDD(row.followup1_date) : "");
    setF1r(row.followup1_remark || "");
    setF2d(row.followup2_date ? toYYYYMMDD(row.followup2_date) : "");
    setF2r(row.followup2_remark || "");
    setF3d(row.followup3_date ? toYYYYMMDD(row.followup3_date) : "");
    setF3r(row.followup3_remark || "");
    setShowFollowup(true);
  };

  const saveFollowups = async () => {
    if (!selected) return;
    await api.put(`/api/insurance-followup/${selected.source}/${selected.id}`, {
      followup1_date: f1d || null, followup1_remark: f1r || null,
      followup2_date: f2d || null, followup2_remark: f2r || null,
      followup3_date: f3d || null, followup3_remark: f3r || null,
    });
    setShowFollowup(false);
    setSelected(null);
    fetchData();
  };

  const openRenew = (row: Row) => {
    setRenewRow(row);
    setRenewStart(""); // user selects
    setRenewPhone(row.phone || "");
    setRenewPremium("");
    setShowRenew(true);
  };

  const saveRenew = async () => {
    if (!renewRow) return;

    const p = phone10(renewPhone);
    if (!renewStart) return alert("start_date is required");
    if (p.length !== 10) return alert("phone must be exactly 10 digits (numbers only)");

    setSavingRenew(true);
    try {
      await api.put(`/api/insurance-policies/${renewRow.id}`, {
        start_date: renewStart,
        expiry_date: renewExpiry,
        phone: p,
        premium: renewPremium ? Number(renewPremium) : null,
      });

      setShowRenew(false);
      setRenewRow(null);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Renew failed");
    } finally {
      setSavingRenew(false);
    }
  };



  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!canView) return <div style={{ padding: 20 }}>Permission denied</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={card}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Insurance</h2>
            <Pill bg="#f3f4f6">Combined (Sale + Renewal)</Pill>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
  {/* Owner-only Import/Export */}
  <OwnerImportExportButtons
  role={user?.role}
  canImport={!!permissions.import_insurance}
  canExport={!!permissions.export_insurance}
  filters={{
    source: sourceFilter,
    search,
    from,
    to,
    status: statusFilter,
  }}
  onImported={() => {
    setPage(1);
    fetchData();
  }}
/>


  {/* Everyone can add policy */}
  <button style={btnOutline} onClick={() => (window.location.href = "/insurance/add")}>
    + Add Policy
  </button>
</div>

        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
          <select style={input} value={sourceFilter} onChange={(e) => { setPage(1); setSourceFilter(e.target.value as any); }}>
            <option value="all">All Sources</option>
            <option value="SALE">SALE</option>
            <option value="RENEWAL">RENEWAL</option>
          </select>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={label}>Start From</span>
            <input style={input} type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={label}>Start To</span>
            <input style={input} type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
          </div>

          <input
            style={{ ...input, minWidth: 320, flex: 1 }}
            placeholder="Search policy / customer / vehicle / phone / company"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button style={statusFilter === "all" ? chipActive : chip} onClick={() => setStatusFilter("all")}>All</button>
          <button style={statusFilter === "active" ? chipActive : chip} onClick={() => setStatusFilter("active")}>Active (&gt;10 days)</button>
          <button style={statusFilter === "expiring" ? chipActive : chip} onClick={() => setStatusFilter("expiring")}>Expiring (0–10 days)</button>
          <button style={statusFilter === "expired" ? chipActive : chip} onClick={() => setStatusFilter("expired")}>Expired</button>
        </div>

        {errMsg && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "#fee2e2", color: "#991b1b", fontWeight: 600 }}>
            API Error: {errMsg}
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ ...card, marginTop: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["Source","Policy","Customer","Phone","Vehicle No","Chassis / Engine","Model","Company","Start","Expiry","Status","Action"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "12px 12px", fontSize: 12, color: "#374151", borderBottom: "1px solid #eee" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row) => {
              const key = `${row.source}-${row.id}`;
              return (
                <tr key={key} style={{ borderTop: "1px solid #eee" }}>
                  <td style={td}>
                    <Pill bg={row.source === "SALE" ? "#fee2e2" : "#dbeafe"}>
                      {row.source}
                    </Pill>
                  </td>

                  <td style={td}>

                    <div style={{ fontWeight: 800 }}>{row.policy_no || "-"}</div>
                  </td>

                  <td style={td}>{row.customer_name || "-"}</td>

                  <td style={td}>
                    <div style={{ fontFamily: "monospace", fontWeight: 700 }}>{row.phone || "-"}</div>
                  </td>

                  <td style={td}>{row.vehicle_no || "-"}</td>

                  <td style={td}>
                    <div style={{ fontSize: 12, lineHeight: "16px" }}>
                      <div><b>Ch:</b> {row.chassis_number || "-"}</div>
                      <div><b>En:</b> {row.engine_number || "-"}</div>
                    </div>
                  </td>

                  <td style={td}>{row.model_name || "-"}</td>
                  <td style={td}>{row.company || "-"}</td>
                  <td style={td}>{row.start_date || "-"}</td>
                  <td style={td}>{row.expiry_date || "-"}</td>
                  <td style={td}><StatusBadge daysLeft={row.days_left} color={row.status_color} /></td>

                  <td style={td}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={btnOutlineSmall} onClick={() => openFollowup(row)}>Follow-up</button>
                      <button
                        style={btnPrimarySmall}
                        onClick={() => {
                          if (!canRenew) return alert("Permission denied");
                          openRenew(row);
                        }}
                      >
                        Renew
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!filteredRows.length && (
              <tr>
                <td colSpan={12} style={{ padding: 20, color: "#6b7280" }}>
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderTop: "1px solid #eee" }}>
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
      </div>

      {/* Renew Modal */}
      {showRenew && renewRow && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Renew ({renewRow.source} Policy)</h3>
              <button style={closeBtn} onClick={() => setShowRenew(false)}>X</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div>
                <div style={label}>Start Date *</div>
                <input style={input} type="date" value={renewStart} onChange={(e) => setRenewStart(e.target.value)} />
              </div>

              <div>
                <div style={label}>Expiry Date (auto)</div>
                <input style={{ ...input, background: "#f3f4f6" }} readOnly value={renewExpiry} />
              </div>

              <div>
                <div style={label}>Phone (10 digits) *</div>
                <input
                  style={input}
                  value={renewPhone}
                  onChange={(e) => setRenewPhone(phone10(e.target.value))}
                  placeholder="9876543210"
                />
              </div>

              <div>
                <div style={label}>Premium</div>
                <input style={input} value={renewPremium} onChange={(e) => setRenewPremium(e.target.value)} placeholder="e.g. 1650" />
              </div>
            </div>

            <div style={{ marginTop: 10, color: "#6b7280", fontSize: 12 }}>
              Expiry is auto-calculated (Start + 1 year − 1 day). Database triggers also enforce it.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button style={btnOutlineSmall} onClick={() => setShowRenew(false)}>Cancel</button>
              <button style={btnPrimarySmall} onClick={saveRenew} disabled={savingRenew}>
                {savingRenew ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {showFollowup && selected && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Follow-up ({selected.customer_name})</h3>
              <button style={closeBtn} onClick={() => setShowFollowup(false)}>X</button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
              <div style={label}>Followup 1</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={input} type="date" value={f1d} onChange={(e) => setF1d(e.target.value)} />
                <input style={{ ...input, flex: 1 }} value={f1r} onChange={(e) => setF1r(e.target.value)} placeholder="Remark" />
              </div>

              <div style={label}>Followup 2</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={input} type="date" value={f2d} onChange={(e) => setF2d(e.target.value)} />
                <input style={{ ...input, flex: 1 }} value={f2r} onChange={(e) => setF2r(e.target.value)} placeholder="Remark" />
              </div>

              <div style={label}>Followup 3</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={input} type="date" value={f3d} onChange={(e) => setF3d(e.target.value)} />
                <input style={{ ...input, flex: 1 }} value={f3r} onChange={(e) => setF3r(e.target.value)} placeholder="Remark" />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button style={btnOutlineSmall} onClick={() => setShowFollowup(false)}>Cancel</button>
              <button style={btnPrimarySmall} onClick={saveFollowups}>Save</button>
            </div>
          </div>
        </div>
      )}
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

const label: any = { fontSize: 12, color: "#6b7280", fontWeight: 700 };

const td: any = { padding: "12px 12px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };

const btnOutline: any = {
  height: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const btnOutlineSmall: any = {
  height: 36,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const btnPrimarySmall: any = {
  height: 36,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #dc2626",
  background: "#dc2626",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const chip: any = {
  height: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const chipActive: any = {
  ...chip,
  background: "#111827",
  color: "#fff",
  border: "1px solid #111827",
};

const overlay: any = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
  zIndex: 50,
};

const modal: any = {
  width: "min(720px, 96vw)",
  background: "#fff",
  borderRadius: 14,
  border: "1px solid #eee",
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
};

const closeBtn: any = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

