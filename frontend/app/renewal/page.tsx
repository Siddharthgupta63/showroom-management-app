"use client";

import React, { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";

type RenewalRow = {
  renewal_id: number;
  sale_id: number;
  customer_name: string | null;
  phone: string | null;
  model_name: string | null;
  chassis_number: string | null;
  engine_number: string | null;
  renewal_type: "insurance" | "rc" | "both";
  company: string | null;
  policy_number: string | null;
  invoice_number: string | null;
  premium_amount: number | null;
  renewal_date: string | null;
  renewed_by_name: string | null;
  insurance_start_date: string | null;
  insurance_expiry_date: string | null;
  days_from_expiry: number | null;
  insurance_status: "active" | "expiring" | "expired" | "no_expiry";
  notes: string | null;
};

type Summary = {
  all: number;
  insurance: number;
  rc: number;
  both: number;
  premiumTotal: number;
};

function niceDate(v?: string | null) {
  if (!v) return "-";
  return String(v).slice(0, 10);
}

function niceMoney(v: any) {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return `₹${n.toLocaleString("en-IN")}`;
}

function Pill({
  children,
  bg,
  color = "#111",
}: {
  children: React.ReactNode;
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

function insuranceStatusBadge(status?: string | null) {
  if (status === "expired") return <Pill bg="#111" color="#fff">Expired</Pill>;
  if (status === "expiring") return <Pill bg="#f59e0b" color="#fff">Expiring</Pill>;
  if (status === "active") return <Pill bg="#16a34a" color="#fff">Active</Pill>;
  return <Pill bg="#e5e7eb">No Expiry</Pill>;
}

export default function RenewalPage() {
  const { permissions, loading: permLoading } = usePermissions();

  const canView = !!permissions.view_insurance;
  const canExport = !!permissions.export_insurance;
  const canAdd = !!permissions.add_insurance;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RenewalRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [renewalType, setRenewalType] = useState<"all" | "insurance" | "rc" | "both">("all");
  const [insuranceStatus, setInsuranceStatus] = useState<"all" | "active" | "expiring" | "expired" | "no_expiry">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  const [summary, setSummary] = useState<Summary>({
    all: 0,
    insurance: 0,
    rc: 0,
    both: 0,
    premiumTotal: 0,
  });

  const fetchDashboard = async () => {
    if (!canView) return;

    try {
      setError(null);
      setLoading(true);

      const res = await api.get("/api/renewal/dashboard", {
        params: {
          page,
          pageSize,
          search: search.trim() || undefined,
          renewalType,
          insuranceStatus,
          from: from || undefined,
          to: to || undefined,
        },
      });

      setRows(res.data?.data || []);
      setTotalRows(Number(res.data?.total || 0));
      setTotalPages(Number(res.data?.totalPages || 1));
      setSummary({
        all: Number(res.data?.summary?.all || 0),
        insurance: Number(res.data?.summary?.insurance || 0),
        rc: Number(res.data?.summary?.rc || 0),
        both: Number(res.data?.summary?.both || 0),
        premiumTotal: Number(res.data?.summary?.premiumTotal || 0),
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load renewals");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (permLoading) return;
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permLoading, page, pageSize, renewalType, insuranceStatus, from, to, canView]);

  useEffect(() => {
    if (permLoading) return;
    const t = setTimeout(() => {
      setPage(1);
      fetchDashboard();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, permLoading, canView]);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (renewalType !== "all") params.set("renewalType", renewalType);
    if (insuranceStatus !== "all") params.set("insuranceStatus", insuranceStatus);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/renewal/export?${params.toString()}`;
  }, [search, renewalType, insuranceStatus, from, to]);

  return (
    <AuthGuard roles={["owner", "admin", "manager", "renewal", "sales", "rc"]}>
      <div style={pageWrap}>
        {permLoading ? (
          <div style={cardCompact}>Loading permissions...</div>
        ) : !canView ? (
          <div style={cardCompact}>Permission denied</div>
        ) : (
          <>
            <div style={cardCompact}>
              <div style={headerRow}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Renewal Dashboard</h2>
                  <Pill bg="#f3f4f6">Permission Based</Pill>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {canExport && (
                    <button
                      style={btnOutlineCompact}
                      onClick={() => window.open(exportUrl, "_blank")}
                    >
                      Export
                    </button>
                  )}

                  {canAdd && (
                    <button
                      style={btnPrimaryCompact}
                      onClick={() => (window.location.href = "/renewal/create")}
                    >
                      + Add Policy
                    </button>
                  )}
                </div>
              </div>

              <div style={compactStatsWrap}>
                <div style={compactStat}><span style={compactStatLabel}>Total</span><b>{summary.all}</b></div>
                <div style={compactStat}><span style={compactStatLabel}>Insurance</span><b>{summary.insurance}</b></div>
                <div style={compactStat}><span style={compactStatLabel}>RC</span><b>{summary.rc}</b></div>
                <div style={compactStat}><span style={compactStatLabel}>Both</span><b>{summary.both}</b></div>
                <div style={compactStat}><span style={compactStatLabel}>Premium Total</span><b>{niceMoney(summary.premiumTotal)}</b></div>
              </div>

              <div style={filtersBoxCompact}>
                <div style={filterGridCompact}>
                  <div>
                    <div style={labelCompact}>Renewal Type</div>
                    <select style={inputCompact} value={renewalType} onChange={(e) => { setPage(1); setRenewalType(e.target.value as any); }}>
                      <option value="all">All</option>
                      <option value="insurance">Insurance</option>
                      <option value="rc">RC</option>
                      <option value="both">Both</option>
                    </select>
                  </div>

                  <div>
                    <div style={labelCompact}>Insurance Status</div>
                    <select style={inputCompact} value={insuranceStatus} onChange={(e) => { setPage(1); setInsuranceStatus(e.target.value as any); }}>
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="expiring">Expiring</option>
                      <option value="expired">Expired</option>
                      <option value="no_expiry">No Expiry</option>
                    </select>
                  </div>

                  <div>
                    <div style={labelCompact}>Renewal From</div>
                    <input style={inputCompact} type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
                  </div>

                  <div>
                    <div style={labelCompact}>Renewal To</div>
                    <input style={inputCompact} type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
                  </div>

                  <div>
                    <div style={labelCompact}>Rows</div>
                    <select style={inputCompact} value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
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
                    placeholder="Search renewal / sale / customer / phone / model / policy / invoice"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {error && <div style={errorBox}>{error}</div>}
            </div>

            <div style={{ ...cardCompact, marginTop: 10, overflowX: "auto" }}>
              {loading ? (
                <div style={{ padding: 16 }}>Loading renewal dashboard...</div>
              ) : (
                <table style={tableCompact}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {[
                        "Renewal",
                        "Customer / Phone",
                        "Vehicle",
                        "Company / Policy",
                        "Renewal Date",
                        "Insurance Expiry",
                        "Premium",
                        "Status",
                        "Notes",
                      ].map((h) => (
                        <th key={h} style={thCompact}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.renewal_id}>
                        <td style={tdCompact}>
                          <div style={strongTextCompact}>#{r.renewal_id}</div>
                          <div style={subTextCompact}>Sale: {r.sale_id}</div>
                          <div style={{ marginTop: 4 }}>
                            <Pill bg="#dbeafe">{r.renewal_type?.toUpperCase()}</Pill>
                          </div>
                        </td>

                        <td style={tdCompact}>
                          <div style={strongTextCompact}>{r.customer_name || "-"}</div>
                          <div style={subTextCompact}>{r.phone || "-"}</div>
                        </td>

                        <td style={tdCompact}>
                          <div style={strongTextCompact}>{r.model_name || "-"}</div>
                          <div style={subTextCompact}>Ch: {r.chassis_number || "-"}</div>
                          <div style={subTextCompact}>En: {r.engine_number || "-"}</div>
                        </td>

                        <td style={tdCompact}>
                          <div style={strongTextCompact}>{r.company || "-"}</div>
                          <div style={subTextCompact}>Policy: {r.policy_number || "-"}</div>
                          <div style={subTextCompact}>Invoice: {r.invoice_number || "-"}</div>
                        </td>

                        <td style={tdCompact}>
                          <div style={strongTextCompact}>{niceDate(r.renewal_date)}</div>
                          <div style={subTextCompact}>By: {r.renewed_by_name || "-"}</div>
                        </td>

                        <td style={tdCompact}>
                          <div style={strongTextCompact}>{niceDate(r.insurance_expiry_date)}</div>
                          <div style={subTextCompact}>Start: {niceDate(r.insurance_start_date)}</div>
                          <div style={subTextCompact}>
                            Days from expiry: {r.days_from_expiry == null ? "-" : r.days_from_expiry}
                          </div>
                        </td>

                        <td style={tdCompact}>
                          <div style={strongTextCompact}>{niceMoney(r.premium_amount)}</div>
                        </td>

                        <td style={tdCompact}>
                          {insuranceStatusBadge(r.insurance_status)}
                        </td>

                        <td style={tdCompact}>
                          <div style={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>
                            {r.notes || "-"}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {!rows.length && (
                      <tr>
                        <td colSpan={9} style={{ padding: 16, color: "#6b7280" }}>
                          No renewal records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

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
          </>
        )}
      </div>
    </AuthGuard>
  );
}

const pageWrap: any = { padding: 10, maxWidth: 1600, margin: "0 auto" };
const cardCompact: any = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };
const headerRow: any = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" };
const compactStatsWrap: any = { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8, marginTop: 10 };
const compactStat: any = { border: "1px solid #e5e7eb", borderRadius: 10, padding: "7px 10px", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 };
const compactStatLabel: any = { fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" };
const filtersBoxCompact: any = { marginTop: 10, border: "1px solid #eef2f7", borderRadius: 12, padding: 10, background: "#fcfcfd" };
const filterGridCompact: any = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 0.8fr", gap: 8 };
const inputCompact: any = { height: 34, width: "100%", padding: "0 10px", borderRadius: 8, border: "1px solid #d1d5db", outline: "none", fontSize: 13, background: "#fff" };
const labelCompact: any = { fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 };
const errorBox: any = { marginTop: 10, padding: 10, borderRadius: 10, background: "#fee2e2", color: "#991b1b", fontWeight: 600, fontSize: 13 };
const tableCompact: any = { width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1100 };
const thCompact: any = { textAlign: "left", padding: "9px 8px", fontSize: 11, color: "#374151", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
const tdCompact: any = { padding: "9px 8px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top", fontSize: 13 };
const strongTextCompact: any = { fontWeight: 800, color: "#111827", fontSize: 13 };
const subTextCompact: any = { marginTop: 3, fontSize: 11, color: "#6b7280" };
const paginationBarCompact: any = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: 10, borderTop: "1px solid #eee" };
const btnOutlineCompact: any = { height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnPrimaryCompact: any = { height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnOutlineSmallCompact: any = { height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" };