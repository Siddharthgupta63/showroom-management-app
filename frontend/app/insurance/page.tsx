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
  cpa_number?: string | null;
  cpa_included?: number | boolean | null;
  agent?: string | null;
  agent_name?: string | null;
  insurance_broker?: string | null;
  broker?: string | null;
  premium_amount?: number | null;
  premium?: number | null;
  invoice_number?: string | null;
  remarks?: string | null;
  insurance_type?: string | null;
  renewal_date?: string | null;
};

type Summary = {
  all: number;
  active: number;
  expiring: number;
  expired: number;
};

const phone10 = (v: any) => String(v ?? "").replace(/\D/g, "").slice(0, 10);

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
        justifyContent: "center",
        padding: "4px 8px",
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
        lineHeight: 1.1,
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

function niceDate(v?: string | null) {
  if (!v) return "-";
  return toYYYYMMDD(v);
}

function niceMoney(v: any) {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return `₹${n.toLocaleString("en-IN")}`;
}

function detailValue(v: any) {
  if (v == null || v === "") return "-";
  return String(v);
}

export default function InsurancePage() {
  const { permissions, loading } = usePermissions();

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const u = getUser();
    const roleFromToken = getRoleFromToken();

    if (!u && roleFromToken) {
      setUser({ role: roleFromToken });
    } else if (u && !u.role && roleFromToken) {
      setUser({ ...u, role: roleFromToken });
    } else {
      setUser(u);
    }
  }, []);

  const canView = !!permissions.view_insurance;
  const canRenew = !!permissions.renew_policy;

  const [sourceFilter, setSourceFilter] = useState<"all" | "SALE" | "RENEWAL">("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expiring" | "expired">("all");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary>({
    all: 0,
    active: 0,
    expiring: 0,
    expired: 0,
  });
  const [errMsg, setErrMsg] = useState("");

  const [showRenew, setShowRenew] = useState(false);
  const [renewRow, setRenewRow] = useState<Row | null>(null);
  const [renewStart, setRenewStart] = useState("");
  const [renewPhone, setRenewPhone] = useState("");
  const [renewPremium, setRenewPremium] = useState("");
  const renewExpiry = useMemo(() => calcExpiry(renewStart), [renewStart]);
  const [savingRenew, setSavingRenew] = useState(false);

  const [showFollowup, setShowFollowup] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [f1d, setF1d] = useState(""); const [f1r, setF1r] = useState("");
  const [f2d, setF2d] = useState(""); const [f2r, setF2r] = useState("");
  const [f3d, setF3d] = useState(""); const [f3r, setF3r] = useState("");

  const [showDetails, setShowDetails] = useState(false);
  const [detailRowState, setDetailRowState] = useState<Row | null>(null);

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
        cpa_number: r.cpa_number ?? null,
        cpa_included: r.cpa_included ?? null,
        agent: r.agent ?? null,
        agent_name: r.agent_name ?? null,
        insurance_broker: r.insurance_broker ?? null,
        broker: r.broker ?? null,
        premium_amount: r.premium_amount ?? null,
        premium: r.premium ?? null,
        invoice_number: r.invoice_number ?? null,
        remarks: r.remarks ?? null,
        insurance_type: r.insurance_type ?? null,
        renewal_date: r.renewal_date ?? null,
      }));

      setRows(normalized);
      setTotalPages(Number(res.data?.totalPages || 1));
      setTotalRows(Number(res.data?.total || 0));
      setSummary({
        all: Number(res.data?.summary?.all || 0),
        active: Number(res.data?.summary?.active || 0),
        expiring: Number(res.data?.summary?.expiring || 0),
        expired: Number(res.data?.summary?.expired || 0),
      });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Request failed";
      setErrMsg(msg);
    }
  };

  useEffect(() => {
    if (loading) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, page, pageSize, sourceFilter, from, to]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      setPage(1);
      fetchData();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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
      followup1_date: f1d || null,
      followup1_remark: f1r || null,
      followup2_date: f2d || null,
      followup2_remark: f2r || null,
      followup3_date: f3d || null,
      followup3_remark: f3r || null,
    });
    setShowFollowup(false);
    setSelected(null);
    fetchData();
  };

  const openRenew = (row: Row) => {
    setRenewRow(row);
    setRenewStart("");
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

  const openDetails = (row: Row) => {
    setDetailRowState(row);
    setShowDetails(true);
  };

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!canView) return <div style={{ padding: 20 }}>Permission denied</div>;

  return (
    <div style={pageWrap}>
      <div style={cardCompact}>
        <div style={headerRow}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Insurance</h2>
            <Pill bg="#f3f4f6">Combined (Sale + Renewal)</Pill>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
            <button style={btnOutlineCompact} onClick={() => (window.location.href = "/insurance/add")}>
              + Add Policy
            </button>
          </div>
        </div>

        <div style={compactStatsWrap}>
          <div style={compactStat}><span style={compactStatLabel}>Loaded</span><b>{summary.all}</b></div>
          <div style={compactStat}><span style={compactStatLabel}>Active</span><b>{summary.active}</b></div>
          <div style={compactStat}><span style={compactStatLabel}>Expiring</span><b>{summary.expiring}</b></div>
          <div style={compactStat}><span style={compactStatLabel}>Expired</span><b>{summary.expired}</b></div>
        </div>

        <div style={filtersBoxCompact}>
          <div style={filterGridCompact}>
            <div>
              <div style={labelCompact}>Source</div>
              <select
                style={inputCompact}
                value={sourceFilter}
                onChange={(e) => {
                  setPage(1);
                  setSourceFilter(e.target.value as any);
                }}
              >
                <option value="all">All Sources</option>
                <option value="SALE">SALE</option>
                <option value="RENEWAL">RENEWAL</option>
              </select>
            </div>

            <div>
              <div style={labelCompact}>Start From</div>
              <input
                style={inputCompact}
                type="date"
                value={from}
                onChange={(e) => {
                  setPage(1);
                  setFrom(e.target.value);
                }}
              />
            </div>

            <div>
              <div style={labelCompact}>Start To</div>
              <input
                style={inputCompact}
                type="date"
                value={to}
                onChange={(e) => {
                  setPage(1);
                  setTo(e.target.value);
                }}
              />
            </div>

            <div>
              <div style={labelCompact}>Rows</div>
              <select
                style={inputCompact}
                value={pageSize}
                onChange={(e) => {
                  setPage(1);
                  setPageSize(Number(e.target.value));
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <input
              style={{ ...inputCompact, width: "100%" }}
              placeholder="Search policy / customer / vehicle / phone / company"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <button style={statusFilter === "all" ? chipActiveCompact : chipCompact} onClick={() => setStatusFilter("all")}>
              All ({summary.all})
            </button>
            <button style={statusFilter === "active" ? chipActiveCompact : chipCompact} onClick={() => setStatusFilter("active")}>
              Active ({summary.active})
            </button>
            <button style={statusFilter === "expiring" ? chipActiveCompact : chipCompact} onClick={() => setStatusFilter("expiring")}>
              Expiring ({summary.expiring})
            </button>
            <button style={statusFilter === "expired" ? chipActiveCompact : chipCompact} onClick={() => setStatusFilter("expired")}>
              Expired ({summary.expired})
            </button>
          </div>
        </div>

        {errMsg && <div style={errorBox}>API Error: {errMsg}</div>}
      </div>

      <div style={{ ...cardCompact, marginTop: 10, overflowX: "auto" }}>
        <table style={tableCompact}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {[
                "Src",
                "Policy",
                "Customer / Phone",
                "Vehicle / Model",
                "Chassis / Engine",
                "Company",
                "Dates",
                "Status",
                "Action",
              ].map((h) => (
                <th key={h} style={thCompact}>{h}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row) => {
              const key = `${row.source}-${row.id}`;
              return (
                <tr key={key}>
                  <td style={tdCompact}>
                    <Pill bg={row.source === "SALE" ? "#dcfce7" : "#dbeafe"}>
                      {row.source}
                    </Pill>
                  </td>

                  <td style={tdCompact}>
                    <div style={strongTextCompact}>{row.policy_no || "-"}</div>
                    <div style={subTextCompact}>ID: {row.id}</div>
                    {row.sale_id ? <div style={subTextCompact}>Sale: {row.sale_id}</div> : null}
                  </td>

                  <td style={tdCompact}>
                    <div style={strongTextCompact}>{row.customer_name || "-"}</div>
                    <div style={subTextCompactMono}>{row.phone || "-"}</div>
                  </td>

                  <td style={tdCompact}>
                    <div style={strongTextCompact}>{row.vehicle_no || "-"}</div>
                    <div style={subTextCompact}>{row.model_name || "-"}</div>
                  </td>

                  <td style={tdCompact}>
                    <div style={miniStackCompact}>
                      <div><b>Ch:</b> {row.chassis_number || "-"}</div>
                      <div><b>En:</b> {row.engine_number || "-"}</div>
                    </div>
                  </td>

                  <td style={tdCompact}>
                    <div style={strongTextCompact}>{row.company || "-"}</div>
                  </td>

                  <td style={tdCompact}>
                    <div style={miniStackCompact}>
                      <div><b>S:</b> {row.start_date || "-"}</div>
                      <div><b>E:</b> {row.expiry_date || "-"}</div>
                    </div>
                  </td>

                  <td style={tdCompact}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      <StatusBadge daysLeft={row.days_left} color={row.status_color} />
                    </div>
                  </td>

                  <td style={tdCompact}>
                    <div style={actionWrapCompact}>
                      <button style={btnOutlineSmallCompact} onClick={() => openDetails(row)}>Details</button>
                      <button style={btnOutlineSmallCompact} onClick={() => openFollowup(row)}>Follow-up</button>
                      <button
                        style={btnPrimarySmallCompact}
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
                <td colSpan={9} style={{ padding: 16, color: "#6b7280", fontSize: 13 }}>
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={paginationBarCompact}>
          <div style={{ color: "#6b7280", fontSize: 12 }}>
            Page <b>{page}</b> / {totalPages} &nbsp; | &nbsp; Total rows: <b>{totalRows}</b>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button style={btnOutlineSmallCompact} disabled={page <= 1} onClick={() => setPage(1)}>First</button>
            <button style={btnOutlineSmallCompact} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
            <button style={btnOutlineSmallCompact} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
            <button style={btnOutlineSmallCompact} disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last</button>
          </div>
        </div>
      </div>

      {showDetails && detailRowState && (
        <div style={overlay}>
          <div style={detailModal}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Insurance Details</h3>
              <button style={closeBtn} onClick={() => setShowDetails(false)}>X</button>
            </div>

            <div style={detailsGrid}>
              <div style={detailCard}><div style={detailLabel}>Source</div><div style={detailText}>{detailValue(detailRowState.source)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Insurance ID</div><div style={detailText}>{detailValue(detailRowState.id)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Sale ID</div><div style={detailText}>{detailValue(detailRowState.sale_id)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Policy No</div><div style={detailText}>{detailValue(detailRowState.policy_no)}</div></div>

              <div style={detailCard}><div style={detailLabel}>Customer</div><div style={detailText}>{detailValue(detailRowState.customer_name)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Phone</div><div style={detailText}>{detailValue(detailRowState.phone)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Vehicle No</div><div style={detailText}>{detailValue(detailRowState.vehicle_no)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Model</div><div style={detailText}>{detailValue(detailRowState.model_name)}</div></div>

              <div style={detailCard}><div style={detailLabel}>Chassis No</div><div style={detailText}>{detailValue(detailRowState.chassis_number)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Engine No</div><div style={detailText}>{detailValue(detailRowState.engine_number)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Company</div><div style={detailText}>{detailValue(detailRowState.company)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Insurance Type</div><div style={detailText}>{detailValue(detailRowState.insurance_type)}</div></div>

              <div style={detailCard}><div style={detailLabel}>Start Date</div><div style={detailText}>{niceDate(detailRowState.start_date)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Expiry Date</div><div style={detailText}>{niceDate(detailRowState.expiry_date)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Renewal Date</div><div style={detailText}>{niceDate(detailRowState.renewal_date)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Days Left</div><div style={detailText}>{detailValue(detailRowState.days_left)}</div></div>

              <div style={detailCard}><div style={detailLabel}>CPA Included</div><div style={detailText}>{detailRowState.cpa_included ? "Yes" : "No"}</div></div>
              <div style={detailCard}><div style={detailLabel}>CPA Number</div><div style={detailText}>{detailValue(detailRowState.cpa_number)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Agent / Broker</div><div style={detailText}>{detailValue(detailRowState.agent || detailRowState.agent_name || detailRowState.insurance_broker || detailRowState.broker)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Premium</div><div style={detailText}>{niceMoney(detailRowState.premium_amount ?? detailRowState.premium)}</div></div>

              <div style={detailCard}><div style={detailLabel}>Invoice Number</div><div style={detailText}>{detailValue(detailRowState.invoice_number)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Follow-up 1 Date</div><div style={detailText}>{niceDate(detailRowState.followup1_date)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Follow-up 2 Date</div><div style={detailText}>{niceDate(detailRowState.followup2_date)}</div></div>
              <div style={detailCard}><div style={detailLabel}>Follow-up 3 Date</div><div style={detailText}>{niceDate(detailRowState.followup3_date)}</div></div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={detailLabel}>Remarks</div>
              <div style={remarksBox}>{detailValue(detailRowState.remarks)}</div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              <div style={detailCard}>
                <div style={detailLabel}>Follow-up 1 Remark</div>
                <div style={detailText}>{detailValue(detailRowState.followup1_remark)}</div>
              </div>
              <div style={detailCard}>
                <div style={detailLabel}>Follow-up 2 Remark</div>
                <div style={detailText}>{detailValue(detailRowState.followup2_remark)}</div>
              </div>
              <div style={detailCard}>
                <div style={detailLabel}>Follow-up 3 Remark</div>
                <div style={detailText}>{detailValue(detailRowState.followup3_remark)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRenew && renewRow && (
        <div style={overlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Renew ({renewRow.source} Policy)</h3>
              <button style={closeBtn} onClick={() => setShowRenew(false)}>X</button>
            </div>

            <div style={renewGrid}>
              <div>
                <div style={labelCompact}>Start Date *</div>
                <input style={inputCompact} type="date" value={renewStart} onChange={(e) => setRenewStart(e.target.value)} />
              </div>

              <div>
                <div style={labelCompact}>Expiry Date (auto)</div>
                <input style={{ ...inputCompact, background: "#f3f4f6" }} readOnly value={renewExpiry} />
              </div>

              <div>
                <div style={labelCompact}>Phone (10 digits) *</div>
                <input
                  style={inputCompact}
                  value={renewPhone}
                  onChange={(e) => setRenewPhone(phone10(e.target.value))}
                  placeholder="9876543210"
                />
              </div>

              <div>
                <div style={labelCompact}>Premium</div>
                <input style={inputCompact} value={renewPremium} onChange={(e) => setRenewPremium(e.target.value)} placeholder="e.g. 1650" />
              </div>
            </div>

            <div style={{ marginTop: 8, color: "#6b7280", fontSize: 12 }}>
              Expiry is auto-calculated (Start + 1 year − 1 day).
            </div>

            <div style={modalActions}>
              <button style={btnOutlineSmallCompact} onClick={() => setShowRenew(false)}>Cancel</button>
              <button style={btnPrimarySmallCompact} onClick={saveRenew} disabled={savingRenew}>
                {savingRenew ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFollowup && selected && (
        <div style={overlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Follow-up ({selected.customer_name})</h3>
              <button style={closeBtn} onClick={() => setShowFollowup(false)}>X</button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              <div style={followupRow}>
                <div style={labelBox}>Follow-up 1</div>
                <div style={followupInputs}>
                  <input style={inputCompact} type="date" value={f1d} onChange={(e) => setF1d(e.target.value)} />
                  <input style={{ ...inputCompact, flex: 1 }} value={f1r} onChange={(e) => setF1r(e.target.value)} placeholder="Remark" />
                </div>
              </div>

              <div style={followupRow}>
                <div style={labelBox}>Follow-up 2</div>
                <div style={followupInputs}>
                  <input style={inputCompact} type="date" value={f2d} onChange={(e) => setF2d(e.target.value)} />
                  <input style={{ ...inputCompact, flex: 1 }} value={f2r} onChange={(e) => setF2r(e.target.value)} placeholder="Remark" />
                </div>
              </div>

              <div style={followupRow}>
                <div style={labelBox}>Follow-up 3</div>
                <div style={followupInputs}>
                  <input style={inputCompact} type="date" value={f3d} onChange={(e) => setF3d(e.target.value)} />
                  <input style={{ ...inputCompact, flex: 1 }} value={f3r} onChange={(e) => setF3r(e.target.value)} placeholder="Remark" />
                </div>
              </div>
            </div>

            <div style={modalActions}>
              <button style={btnOutlineSmallCompact} onClick={() => setShowFollowup(false)}>Cancel</button>
              <button style={btnPrimarySmallCompact} onClick={saveFollowups}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* compact styles */
const pageWrap: any = {
  padding: 10,
  maxWidth: 1600,
  margin: "0 auto",
};

const cardCompact: any = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 10,
  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
};

const headerRow: any = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
};

const compactStatsWrap: any = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
  marginTop: 10,
};

const compactStat: any = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "7px 10px",
  background: "#fafafa",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const compactStatLabel: any = {
  fontSize: 11,
  color: "#6b7280",
  fontWeight: 700,
  textTransform: "uppercase",
};

const filtersBoxCompact: any = {
  marginTop: 10,
  border: "1px solid #eef2f7",
  borderRadius: 12,
  padding: 10,
  background: "#fcfcfd",
};

const filterGridCompact: any = {
  display: "grid",
  gridTemplateColumns: "1.1fr 1fr 1fr 0.8fr",
  gap: 8,
};

const inputCompact: any = {
  height: 34,
  width: "100%",
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  outline: "none",
  fontSize: 13,
  background: "#fff",
};

const labelCompact: any = {
  fontSize: 11,
  color: "#6b7280",
  fontWeight: 700,
  marginBottom: 4,
};

const errorBox: any = {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 600,
  fontSize: 13,
};

const tableCompact: any = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  minWidth: 980,
};

const thCompact: any = {
  textAlign: "left",
  padding: "9px 8px",
  fontSize: 11,
  color: "#374151",
  borderBottom: "1px solid #e5e7eb",
  position: "sticky",
  top: 0,
  whiteSpace: "nowrap",
};

const tdCompact: any = {
  padding: "9px 8px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
  fontSize: 13,
};

const strongTextCompact: any = {
  fontWeight: 800,
  color: "#111827",
  fontSize: 13,
};

const subTextCompact: any = {
  marginTop: 3,
  fontSize: 11,
  color: "#6b7280",
};

const subTextCompactMono: any = {
  marginTop: 3,
  fontSize: 11,
  color: "#6b7280",
  fontFamily: "monospace",
  fontWeight: 700,
};

const miniStackCompact: any = {
  fontSize: 12,
  lineHeight: "16px",
  minWidth: 150,
};

const actionWrapCompact: any = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  minWidth: 180,
};

const paginationBarCompact: any = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  padding: 10,
  borderTop: "1px solid #eee",
};

const btnOutlineCompact: any = {
  height: 34,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const btnOutlineSmallCompact: any = {
  height: 30,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

const btnPrimarySmallCompact: any = {
  height: 30,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #dc2626",
  background: "#dc2626",
  color: "#fff",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
};

const chipCompact: any = {
  height: 30,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

const chipActiveCompact: any = {
  ...chipCompact,
  background: "#111827",
  color: "#fff",
  border: "1px solid #111827",
};

const overlay: any = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.38)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
  zIndex: 50,
};

const modal: any = {
  width: "min(760px, 96vw)",
  maxHeight: "92vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
};

const detailModal: any = {
  width: "min(1100px, 96vw)",
  maxHeight: "92vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
};

const modalHeader: any = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const closeBtn: any = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const renewGrid: any = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 12,
};

const modalActions: any = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 16,
  flexWrap: "wrap",
};

const followupRow: any = {
  display: "grid",
  gridTemplateColumns: "140px 1fr",
  gap: 10,
  alignItems: "center",
};

const labelBox: any = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 700,
};

const followupInputs: any = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const detailsGrid: any = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 14,
};

const detailCard: any = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "#fafafa",
};

const detailLabel: any = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 700,
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const detailText: any = {
  fontSize: 14,
  color: "#111827",
  fontWeight: 600,
  wordBreak: "break-word",
};

const remarksBox: any = {
  minHeight: 80,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "#fafafa",
  color: "#111827",
  fontSize: 14,
  fontWeight: 500,
  whiteSpace: "pre-wrap",
};