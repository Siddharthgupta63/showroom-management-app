"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";

type StageState = "done" | "pending" | "na" | "blocked";

type PipelineRow = {
  sale_id: number;
  customer_name: string;
  mobile: string;
  chassis_number: string;
  engine_number?: string;
  invoice_number?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  sale_date?: string;

  stages: {
    sale: StageState | "done";
    insurance: StageState;
    vahan: StageState;
    hsrp: StageState;
    rc: StageState;
    rto: StageState;
  };

  details: {
    vehicle_no?: string;
    policy_number?: string;
    insurance_company?: string;
    insurance_start_date?: string;
    insurance_expiry_date?: string;

    hsrp_number?: string;
    hsrp_issued_date?: string;

    rc_number?: string;
    rc_issued_date?: string;

    sale_price?: number;
  };
};

type FilterKey =
  | "all"
  | "pending_insurance"
  | "pending_vahan"
  | "pending_hsrp"
  | "pending_rc"
  | "due_renewals"
  | "expired";

function toDateOnly(d?: string) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function formatDateIN(d?: string) {
  const dt = toDateOnly(d);
  if (!dt) return "-";
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(dateISO: string) {
  const d = toDateOnly(dateISO);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / 86400000);
}

function badgeClass(state: StageState) {
  if (state === "done") return "bg-green-100 text-green-800";
  if (state === "pending") return "bg-orange-100 text-orange-800";
  if (state === "blocked") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

function pillClass(active: boolean) {
  return active
    ? "bg-slate-900 text-white border-slate-900"
    : "bg-white text-slate-900 border-slate-300 hover:bg-slate-50";
}

function smallCountPill(n: number) {
  return (
    <span className="ml-2 inline-flex items-center justify-center min-w-[22px] px-2 h-5 text-xs rounded-full bg-slate-100 text-slate-800 border border-slate-200">
      {n}
    </span>
  );
}

type UserLite = { role?: string; permissions?: string[] } | null;

function readUserFromStorage(): UserLite {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

type ActionKey =
  | "open_sale"
  | "open_insurance"
  | "open_vahan"
  | "open_hsrp"
  | "open_rc"
  | "export";

const PERM: Record<ActionKey, string> = {
  open_sale: "pipeline_open_sale",
  open_insurance: "pipeline_open_insurance",
  open_vahan: "pipeline_open_vahan",
  open_hsrp: "pipeline_open_hsrp",
  open_rc: "pipeline_open_rc",
  export: "pipeline_export",
};

function roleAllows(role: string | undefined, action: ActionKey) {
  const r = (role || "").toLowerCase();
  if (r === "owner" || r === "admin" || r === "manager") return true;

  if (action === "open_sale") return r === "sales";
  if (action === "open_insurance") return r === "insurance";
  if (action === "open_vahan") return r === "vahan";
  if (action === "open_hsrp") return r === "hsrp";
  if (action === "open_rc") return r === "rc";

  if (action === "export") return false;

  return false;
}

function KpiCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-3">
      <div className="text-xs text-slate-600">{title}</div>
      <div className="text-2xl font-bold text-slate-900">{Number(value || 0)}</div>
    </div>
  );
}

export default function PipelinePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const { hasPermission, loading: permLoading } = usePermissions();

  const [user, setUser] = useState<UserLite>(null);

  useEffect(() => {
    if (!mounted) return;
    setUser(readUserFromStorage());
  }, [mounted]);

  const role = (user?.role || "").toLowerCase();

  const formatDateSafe = (d?: string) => (mounted ? formatDateIN(d) : "-");
  const daysUntilSafe = (d?: string) => (mounted && d ? daysUntil(d) : null);
  const isOwnerAdminManager =
    role === "owner" || role === "admin" || role === "manager";

  const canAction = (action: ActionKey) => {
    if (isOwnerAdminManager) return true;
    const permKey = PERM[action];
    if (permKey && hasPermission(permKey)) return true;
    return roleAllows(role, action);
  };

  const fetchList = async (query: string) => {
    try {
      setErr("");
      setLoading(true);

      const res = await api.get("/api/pipeline", {
        params: query ? { q: query } : {},
      });

      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.data || res.data?.rows || [];

      if (!Array.isArray(data)) {
        setRows([]);
        setErr("Unexpected server response");
        return;
      }

      setRows(data);
    } catch (e: any) {
      console.error("PIPELINE API ERROR:", e);
      const msg =
        e?.response?.data?.message ||
        (e?.response?.status === 403 ? "Forbidden" : "Server error");
      setRows([]);
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expiryInfo = (row: PipelineRow) => {
    if (!mounted) return { kind: "na" as const };
    const exp = row.details?.insurance_expiry_date;
    if (!exp) return { kind: "na" as const };

    const d = daysUntilSafe(exp);
    if (d === null) return { kind: "na" as const };

    if (d < 0) return { kind: "expired" as const, daysAgo: Math.abs(d) };
    if (d <= 10) return { kind: "due" as const, daysLeft: d };
    return { kind: "ok" as const, daysLeft: d };
  };

  const matchesFilter = (row: PipelineRow, key: FilterKey) => {
    const info = expiryInfo(row);
    if (key === "all") return true;
    if (key === "pending_insurance") return row.stages.insurance === "pending";
    if (key === "pending_vahan") return row.stages.vahan === "pending";
    if (key === "pending_hsrp") return row.stages.hsrp === "pending";
    if (key === "pending_rc") return row.stages.rc === "pending";
    if (key === "due_renewals") return info.kind === "due";
    if (key === "expired") return info.kind === "expired";
    return true;
  };

  const counts = useMemo(() => {
    const base = rows || [];
    const c: Record<FilterKey, number> = {
      all: base.length,
      pending_insurance: base.filter((r) => matchesFilter(r, "pending_insurance"))
        .length,
      pending_vahan: base.filter((r) => matchesFilter(r, "pending_vahan")).length,
      pending_hsrp: base.filter((r) => matchesFilter(r, "pending_hsrp")).length,
      pending_rc: base.filter((r) => matchesFilter(r, "pending_rc")).length,
      due_renewals: base.filter((r) => matchesFilter(r, "due_renewals")).length,
      expired: base.filter((r) => matchesFilter(r, "expired")).length,
    };
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, mounted]);

  const filteredRows = useMemo(() => {
    const base = (rows || []).filter((r) => matchesFilter(r, filter));

    const scored = base.map((r) => {
      const info = expiryInfo(r);
      let score = 999999;

      if (info.kind === "expired") score = -100000 + (info.daysAgo ?? 0);
      if (info.kind === "due") score = info.daysLeft ?? 0;
      if (info.kind === "ok") score = 1000 + (info.daysLeft ?? 0);

      return { r, score };
    });

    scored.sort((a, b) => a.score - b.score);
    return scored.map((x) => x.r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, mounted]);

  const exportCsv = () => {
    if (!canAction("export")) return;
    window.location.href = "/api/pipeline/export";
  };

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-3xl font-bold text-slate-900">Pipeline</div>
            <div className="text-slate-700">
              Sale → Insurance → VAHAN → HSRP → RC → RTO → Renewals (Insurance Expiry)
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={exportCsv}
              disabled={!canAction("export") || permLoading}
              title={canAction("export") ? "Export (CSV)" : "No permission"}
              className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Export (CSV)
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <KpiCard title="Pending Insurance" value={counts.pending_insurance} />
            <KpiCard title="Pending VAHAN" value={counts.pending_vahan} />
            <KpiCard title="Pending HSRP" value={counts.pending_hsrp} />
            <KpiCard title="Pending RC" value={counts.pending_rc} />
            <KpiCard title="Expiring ≤10d" value={counts.due_renewals} />
            <KpiCard title="Expired" value={counts.expired} />
          </div>
        </div>

        <div className="mt-4 bg-white rounded-2xl shadow p-4 border border-slate-200">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search: customer / mobile / chassis / engine / invoice / policy / vehicle no"
              className="flex-1 min-w-[260px] border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400"
            />
            <button
              onClick={() => {
                fetchList(q);
              }}
              className="px-4 py-2 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800"
            >
              Search
            </button>
            <button
              onClick={() => {
                setQ("");
                setFilter("all");
                fetchList("");
              }}
              className="px-4 py-2 rounded border border-slate-300 font-semibold bg-white text-slate-800 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>

          {err ? <div className="text-red-600 mt-2 font-semibold">{err}</div> : null}

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button
              className={`px-4 py-2 rounded-full border font-semibold ${pillClass(
                filter === "all"
              )}`}
              onClick={() => setFilter("all")}
            >
              All {smallCountPill(counts.all)}
            </button>

            <button
              className={`px-4 py-2 rounded-full border font-semibold ${pillClass(
                filter === "pending_insurance"
              )}`}
              onClick={() => setFilter("pending_insurance")}
            >
              Pending Insurance {smallCountPill(counts.pending_insurance)}
            </button>

            <button
              className={`px-4 py-2 rounded-full border font-semibold ${pillClass(
                filter === "pending_vahan"
              )}`}
              onClick={() => setFilter("pending_vahan")}
            >
              Pending VAHAN {smallCountPill(counts.pending_vahan)}
            </button>

            <button
              className={`px-4 py-2 rounded-full border font-semibold ${pillClass(
                filter === "pending_hsrp"
              )}`}
              onClick={() => setFilter("pending_hsrp")}
            >
              Pending HSRP {smallCountPill(counts.pending_hsrp)}
            </button>

            <button
              className={`px-4 py-2 rounded-full border font-semibold ${pillClass(
                filter === "pending_rc"
              )}`}
              onClick={() => setFilter("pending_rc")}
            >
              Pending RC {smallCountPill(counts.pending_rc)}
            </button>

            <button
              className={`px-4 py-2 rounded-full border font-semibold ${pillClass(
                filter === "due_renewals"
              )}`}
              onClick={() => setFilter("due_renewals")}
            >
              Due Renewals (0–10d) {smallCountPill(counts.due_renewals)}
            </button>

            <button
              className={`px-4 py-2 rounded-full border font-semibold ${pillClass(
                filter === "expired"
              )}`}
              onClick={() => setFilter("expired")}
            >
              Expired {smallCountPill(counts.expired)}
            </button>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl shadow overflow-x-auto border border-slate-200">
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-800">
              <tr>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Mobile</th>
                <th className="text-left p-3">Vehicle</th>
                <th className="text-left p-3">Vehicle No</th>
                <th className="text-left p-3">Chassis</th>
                <th className="text-left p-3">Invoice</th>
                <th className="text-left p-3">Policy No</th>
                <th className="text-left p-3">HSRP No</th>
                <th className="text-left p-3">RC No</th>
                <th className="text-left p-3">Renewal (Expiry)</th>
                <th className="text-left p-3">Stages</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>

            <tbody className="text-slate-900">
              {loading ? (
                <tr>
                  <td className="p-4 text-slate-600" colSpan={12}>
                    Loading...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className="p-4 text-slate-600" colSpan={12}>
                    No records
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const info = expiryInfo(row);

                  let expiryBadge = (
                    <span className="inline-flex px-3 py-1 rounded-full bg-slate-100 text-slate-800 font-semibold">
                      N/A
                    </span>
                  );

                  if (info.kind === "expired") {
                    expiryBadge = (
                      <span className="inline-flex px-3 py-1 rounded-full bg-black text-white font-semibold">
                        Expired ({info.daysAgo}d ago)
                      </span>
                    );
                  } else if (info.kind === "due") {
                    expiryBadge = (
                      <span className="inline-flex px-3 py-1 rounded-full bg-orange-600 text-white font-semibold">
                        Due ({info.daysLeft}d)
                      </span>
                    );
                  } else if (info.kind === "ok") {
                    expiryBadge = (
                      <span className="inline-flex px-3 py-1 rounded-full bg-green-600 text-white font-semibold">
                        OK ({info.daysLeft}d)
                      </span>
                    );
                  }

                  const canSale = canAction("open_sale");
                  const canIns = canAction("open_insurance");
                  const canVahan = canAction("open_vahan");
                  const canHsrp = canAction("open_hsrp");
                  const canRc = canAction("open_rc");

                  return (
                    <tr key={row.sale_id} className="border-b border-slate-200">
                      <td className="p-3 font-semibold text-slate-900">
                        {row.customer_name}
                      </td>
                      <td className="p-3 text-slate-900">{row.mobile || "-"}</td>
                      <td className="p-3 text-slate-900">
                        {(row.vehicle_make || "-") + " / " + (row.vehicle_model || "-")}
                      </td>
                      <td className="p-3 text-slate-900">
                        {row.details.vehicle_no || "-"}
                      </td>
                      <td className="p-3 text-slate-900">
                        {row.chassis_number || "-"}
                      </td>
                      <td className="p-3 text-slate-900">
                        {row.invoice_number || "-"}
                      </td>
                      <td className="p-3 text-slate-900">
                        {row.details.policy_number || "-"}
                      </td>
                      <td className="p-3 text-slate-900">
                        {row.details.hsrp_number || "-"}
                      </td>
                      <td className="p-3 text-slate-900">
                        {row.details.rc_number || "-"}
                      </td>

                      <td className="p-3">
                        <div>{expiryBadge}</div>
                        <div className="text-xs text-slate-600 mt-1">
                          {formatDateSafe(row.details.insurance_expiry_date)}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass(
                              "done"
                            )}`}
                          >
                            Sale
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass(
                              row.stages.insurance
                            )}`}
                          >
                            Insurance
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass(
                              row.stages.vahan
                            )}`}
                          >
                            VAHAN
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass(
                              row.stages.hsrp
                            )}`}
                          >
                            HSRP
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass(
                              row.stages.rc
                            )}`}
                          >
                            RC
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass(
                              row.stages.rto
                            )}`}
                          >
                            RTO
                          </span>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/sales/${row.sale_id}`}
                            className={`px-3 py-2 rounded border font-semibold ${
                              canSale
                                ? "bg-slate-900 text-white border-slate-900 hover:bg-black"
                                : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                            }`}
                            onClick={(e) => !canSale && e.preventDefault()}
                          >
                            Open Sale
                          </Link>

                          <Link
                            href={`/insurance?sale_id=${row.sale_id}`}
                            className={`px-3 py-2 rounded border font-semibold ${
                              canIns
                                ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                                : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                            }`}
                            onClick={(e) => !canIns && e.preventDefault()}
                          >
                            Insurance
                          </Link>

                          <Link
                            href={`/vahan/${row.sale_id}`}
                            className={`px-3 py-2 rounded border font-semibold ${
                              canVahan
                                ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                                : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                            }`}
                            onClick={(e) => !canVahan && e.preventDefault()}
                          >
                            VAHAN
                          </Link>

                          <Link
                            href={`/hsrp?sale_id=${row.sale_id}`}
                            className={`px-3 py-2 rounded border font-semibold ${
                              canHsrp
                                ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                                : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                            }`}
                            onClick={(e) => !canHsrp && e.preventDefault()}
                          >
                            HSRP
                          </Link>

                          <Link
                            href={`/rc?sale_id=${row.sale_id}`}
                            className={`px-3 py-2 rounded border font-semibold ${
                              canRc
                                ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                                : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                            }`}
                            onClick={(e) => !canRc && e.preventDefault()}
                          >
                            RC
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-600 mt-4">
          Note: Pipeline rows are filtered server-side by role for visibility.
        </div>
      </div>
    </AuthGuard>
  );
}