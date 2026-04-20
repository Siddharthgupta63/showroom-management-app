"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/apiBase";

type SalesSummary = {
  total_sales?: number;
  total_amount?: number;
  total_ex_showroom?: number;
  total_insurance?: number;
  total_accessories?: number;
};

type StockSummary = {
  total_stock?: number;
  in_stock_count?: number;
  sold_count?: number;
  ageing_0_30?: number;
  ageing_31_60?: number;
  ageing_61_90?: number;
  ageing_90_plus?: number;
};

type OdrcSummary = {
  opening_stock?: number;
  dispatch_count?: number;
  retail_count?: number;
  closing_stock?: number;
};

type AgeingSummary = {
  total_units?: number;
  bucket_0_7?: number;
  bucket_8_15?: number;
  bucket_16_30?: number;
  bucket_31_60?: number;
  bucket_61_90?: number;
  bucket_90_plus?: number;
};

type PurchaseVsSalesSummary = {
  purchase_count?: number;
  purchase_amount?: number;
  sale_count?: number;
  sale_amount?: number;
};

type PurchaseVsSalesModel = {
  model: string;
  purchase: number;
  sales: number;
};

type ReportCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  accent?: string;
};

function formatLocalDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getFinancialYearStartLocal(date: Date) {
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return new Date(year, 3, 1);
}

function formatAmount(value?: number | string | null) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${
      typeof window !== "undefined"
        ? localStorage.getItem("token") || localStorage.getItem("showroom_token") || ""
        : ""
    }`,
  };
}

function StatCard({ title, value, subtitle, accent = "bg-blue-600" }: ReportCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500">{title}</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</div>
          {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
        </div>
        <div className={`h-12 w-2 rounded-full ${accent}`} />
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden print-card">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4">
        <div>
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function PrintButton({
  onClick,
  printing,
}: {
  onClick: () => void;
  printing: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={printing}
      className="inline-flex items-center rounded-xl bg-slate-800 text-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-700 disabled:opacity-60 no-print"
    >
      {printing ? "Preparing..." : "Print"}
    </button>
  );
}

function QuickLink({
  title,
  href,
  desc,
}: {
  title: string;
  href: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-slate-300 print-card"
    >
      <div className="text-base font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{desc}</div>
      <div className="mt-3 text-sm font-semibold text-blue-600">Open report →</div>
    </Link>
  );
}

function HorizontalBars({
  data,
  labelKey,
  valueKey,
  title,
  colorClass = "bg-blue-600",
  emptyText = "No data available",
}: {
  data: any[];
  labelKey: string;
  valueKey: string;
  title: string;
  colorClass?: string;
  emptyText?: string;
}) {
  const max = Math.max(...data.map((x) => Number(x[valueKey] || 0)), 0);

  return (
    <div>
      <div className="mb-4 text-sm font-semibold text-slate-700">{title}</div>
      {data.length === 0 || max === 0 ? (
        <div className="flex h-44 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((row, index) => {
            const width = `${(Number(row[valueKey] || 0) / max) * 100}%`;
            return (
              <div key={index}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-700">{row[labelKey] || "-"}</span>
                  <span className="shrink-0 text-slate-500">{row[valueKey] || 0}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${colorClass}`} style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReportsDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [salesSummary, setSalesSummary] = useState<SalesSummary>({});
  const [stockSummary, setStockSummary] = useState<StockSummary>({});
  const [odrcSummary, setOdrcSummary] = useState<OdrcSummary>({});
  const [ageingSummary, setAgeingSummary] = useState<AgeingSummary>({});
  const [pvssSummary, setPvssSummary] = useState<PurchaseVsSalesSummary>({});
  const [pvssModels, setPvssModels] = useState<PurchaseVsSalesModel[]>([]);
  const [error, setError] = useState("");

  const today = useMemo(() => formatLocalDate(new Date()), []);

  const mtdFrom = useMemo(() => {
    const d = new Date();
    return formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);

  const ytdFrom = useMemo(() => {
    const d = new Date();
    return formatLocalDate(getFinancialYearStartLocal(d));
  }, []);

  useEffect(() => {
    setMounted(true);
    setGeneratedAt(new Date().toLocaleString("en-IN"));
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const headers = getAuthHeaders();

        const [salesRes, stockRes, odrcRes, ageingRes, pvssRes] = await Promise.all([
          fetch(`${API_BASE}/api/reports/sales/analytics?fromDate=${mtdFrom}&toDate=${today}`, {
            headers,
          }),
          fetch(`${API_BASE}/api/reports/stock`, { headers }),
          fetch(`${API_BASE}/api/reports/stock/odrc?reportDate=${today}`, { headers }),
          fetch(`${API_BASE}/api/reports/stock/ageing?asOnDate=${today}&status=in_stock`, {
            headers,
          }),
          fetch(`${API_BASE}/api/reports/purchase-vs-sales?from=${ytdFrom}&to=${today}`, {
            headers,
          }),
        ]);

        const [salesJson, stockJson, odrcJson, ageingJson, pvssJson] = await Promise.all([
          salesRes.json().catch(() => ({})),
          stockRes.json().catch(() => ({})),
          odrcRes.json().catch(() => ({})),
          ageingRes.json().catch(() => ({})),
          pvssRes.json().catch(() => ({})),
        ]);

        const salesPayload = salesJson?.data || salesJson || {};
        const stockPayload = stockJson?.data || stockJson || {};
        const odrcPayload = odrcJson?.data || odrcJson || {};
        const ageingPayload = ageingJson?.data || ageingJson || {};
        const pvssPayload = pvssJson?.data || pvssJson || {};

        setSalesSummary(salesPayload?.summary || {});
        setStockSummary(stockPayload?.summary || {});
        setOdrcSummary(odrcPayload?.summary || {});
        setAgeingSummary(ageingPayload?.summary || {});
        setPvssSummary(pvssPayload?.summary || {});
        setPvssModels(Array.isArray(pvssPayload?.modelWise) ? pvssPayload.modelWise.slice(0, 8) : []);
      } catch (e) {
        console.error(e);
        setError("Failed to load reports dashboard.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [mounted, mtdFrom, today, ytdFrom]);

  const netMovement = Number(pvssSummary.sale_count || 0) - Number(pvssSummary.purchase_count || 0);

  const handlePrint = async () => {
    setPrinting(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    window.print();
    setTimeout(() => setPrinting(false), 250);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          html,
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .no-print,
          aside,
          nav,
          button {
            display: none !important;
          }

          a {
            text-decoration: none !important;
            color: inherit !important;
          }

          .print-grid-4 {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 10px !important;
          }

          .print-grid-3 {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 10px !important;
          }

          .print-grid-2 {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
          }

          .print-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="w-full max-w-none p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Reports Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Central analytics homepage for sales, stock, ageing, ODRC and purchase vs sales.
            </p>
          </div>

          <div className="flex items-center gap-3 no-print">
            <PrintButton onClick={handlePrint} printing={printing} />

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Generated
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-800">
                {mounted ? generatedAt : "--"}
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-slate-500 shadow-sm">
            Loading reports dashboard...
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 print-grid-4">
          <StatCard
            title="MTD Sales"
            value={salesSummary.total_sales || 0}
            subtitle={formatAmount(salesSummary.total_amount)}
            accent="bg-blue-600"
          />
          <StatCard
            title="Current Stock"
            value={stockSummary.in_stock_count || 0}
            subtitle={`Sold: ${stockSummary.sold_count || 0}`}
            accent="bg-amber-500"
          />
          <StatCard
            title="Today's Closing Stock"
            value={odrcSummary.closing_stock || 0}
            subtitle={`Opening: ${odrcSummary.opening_stock || 0}`}
            accent="bg-violet-600"
          />
          <StatCard
            title="90+ Ageing"
            value={ageingSummary.bucket_90_plus || 0}
            subtitle={`Total Units: ${ageingSummary.total_units || 0}`}
            accent="bg-rose-600"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 print-grid-3">
          <StatCard
            title="YTD Purchases"
            value={pvssSummary.purchase_count || 0}
            subtitle={formatAmount(pvssSummary.purchase_amount)}
            accent="bg-cyan-600"
          />
          <StatCard
            title="YTD Sales"
            value={pvssSummary.sale_count || 0}
            subtitle={formatAmount(pvssSummary.sale_amount)}
            accent="bg-emerald-600"
          />
          <StatCard
            title="Accessories + Insurance"
            value={formatAmount(
              Number(salesSummary.total_accessories || 0) +
                Number(salesSummary.total_insurance || 0)
            )}
            subtitle={formatAmount(salesSummary.total_ex_showroom)}
            accent="bg-slate-800"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 print-grid-3">
          <QuickLink
            title="Sales Report"
            href="/reports/sales"
            desc="MTD, YTD, branch, model and detailed sales analytics."
          />
          <QuickLink
            title="Stock Report"
            href="/reports/stock"
            desc="Current stock mix, sold count, ageing buckets and stock details."
          />
          <QuickLink
            title="Purchase vs Sales"
            href="/reports/purchase-vs-sales"
            desc="Business movement report with purchase, sales and comparison."
          />
          <QuickLink
            title="ODRC Report"
            href="/reports/odrc"
            desc="Opening, dispatch, retail and closing stock for the selected day."
          />
          <QuickLink
            title="Stock Ageing"
            href="/reports/stock-ageing"
            desc="Bucket-wise inventory ageing and risky slow-moving units."
          />
          <QuickLink
            title="Dashboard"
            href="/dashboard"
            desc="Back to the operational dashboard and workflow counters."
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-grid-2">
          <Panel
            title="Inventory Health Snapshot"
            subtitle="Fast management view of ageing and live stock"
            action={
              <Link
                href="/reports/stock-ageing"
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                View details
              </Link>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  0-30 Days
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {stockSummary.ageing_0_30 || 0}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  31-60 Days
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {stockSummary.ageing_31_60 || 0}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  61-90 Days
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {stockSummary.ageing_61_90 || 0}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  90+ Days
                </div>
                <div className="mt-2 text-2xl font-bold text-rose-700">
                  {stockSummary.ageing_90_plus || 0}
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="ODRC Snapshot"
            subtitle="Today's operational stock reconciliation"
            action={
              <Link
                href="/reports/odrc"
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                View details
              </Link>
            }
          >
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Opening
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {odrcSummary.opening_stock || 0}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Dispatch
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {odrcSummary.dispatch_count || 0}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Retail
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {odrcSummary.retail_count || 0}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Closing
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {odrcSummary.closing_stock || 0}
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 print-grid-2">
          <Panel
            title="Top Purchase vs Sales Models"
            subtitle="YTD comparison by model"
            action={
              <Link
                href="/reports/purchase-vs-sales"
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                Open report
              </Link>
            }
          >
            <HorizontalBars
              data={pvssModels}
              labelKey="model"
              valueKey="sales"
              title="Sales Count"
              colorClass="bg-blue-600"
              emptyText="No model comparison data"
            />
          </Panel>

          <Panel
            title="Executive Summary"
            subtitle="Operational highlights"
          >
            <div className="space-y-3 text-sm text-slate-700">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="font-semibold text-slate-900">Stock pressure:</span>{" "}
                90+ ageing units are{" "}
                <span className="font-semibold">{ageingSummary.bucket_90_plus || 0}</span>. This
                should be your highest-priority clearance bucket.
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="font-semibold text-slate-900">Purchase vs sales:</span>{" "}
                YTD purchases are{" "}
                <span className="font-semibold">{pvssSummary.purchase_count || 0}</span> and YTD
                sales are <span className="font-semibold">{pvssSummary.sale_count || 0}</span>.
                Movement gap is <span className="font-semibold">{netMovement}</span> units.
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="font-semibold text-slate-900">Daily stock control:</span>{" "}
                Today's closing stock from ODRC is{" "}
                <span className="font-semibold">{odrcSummary.closing_stock || 0}</span>.
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}