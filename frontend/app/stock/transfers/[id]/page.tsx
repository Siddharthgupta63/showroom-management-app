"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";

type ChallanHeader = {
  id: number;
  challan_number: string;
  challan_date: string;
  from_branch_name?: string | null;
  to_branch_name?: string | null;
  transporter_name?: string | null;
  vehicle_number?: string | null;
  driver_name?: string | null;
  driver_mobile?: string | null;
  lr_number?: string | null;
  notes?: string | null;
  remarks?: string | null;
  subtotal_amount?: number | null;
  freight_amount?: number | null;
  loading_amount?: number | null;
  unloading_amount?: number | null;
  other_cost_amount?: number | null;
  discount_amount?: number | null;
  tax_amount?: number | null;
  grand_total_amount?: number | null;
  total_vehicles?: number | null;
  status?: string | null;
};

type ChallanItem = {
  id: number;
  stock_item_id: number;
  model_name?: string | null;
  variant_name?: string | null;
  color?: string | null;
  chassis_number?: string | null;
  engine_number?: string | null;
  unit_amount?: number | null;
  line_amount?: number | null;
};

function money(v: any) {
  const n = Number(v || 0);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusBadge(status?: string | null) {
  const s = String(status || "").toLowerCase();
  if (s === "posted") {
    return <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">POSTED</span>;
  }
  if (s === "cancelled") {
    return <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">CANCELLED</span>;
  }
  return <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700">DRAFT</span>;
}

export default function StockTransferChallanViewPage() {
  const params = useParams();
  const id = params?.id;

  const [header, setHeader] = useState<ChallanHeader | null>(null);
  const [items, setItems] = useState<ChallanItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      setLoading(true);
      const res = await api.get(`/api/stock-transfer-challans/${id}`);
      setHeader(res.data?.data?.header || null);
      setItems(Array.isArray(res.data?.data?.items) ? res.data.data.items : []);
    } catch (e: any) {
      console.error("loadData error:", e);
      alert(e?.response?.data?.message || "Failed to load challan");
    } finally {
      setLoading(false);
    }
  }

  async function postChallan() {
    if (!window.confirm("Post this challan? This will move stock to destination branch.")) return;
    try {
      await api.post(`/api/stock-transfer-challans/${id}/post`);
      await loadData();
      alert("Challan posted successfully");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to post challan");
    }
  }

  async function cancelChallan() {
    const reason = window.prompt("Cancel reason (optional)") || "";
    try {
      await api.post(`/api/stock-transfer-challans/${id}/cancel`, {
        cancel_reason: reason || null,
      });
      await loadData();
      alert("Challan cancelled successfully");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to cancel challan");
    }
  }

  useEffect(() => {
    if (id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <AuthGuard>
        <div className="p-6">Loading...</div>
      </AuthGuard>
    );
  }

  if (!header) {
    return (
      <AuthGuard>
        <div className="p-6">Challan not found</div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="p-4 print:p-0">
        <style jsx global>{`
          @page {
            size: A4 portrait;
            margin: 6mm;
          }

          @media print {
            html, body {
              width: 210mm;
              height: 297mm;
              background: #fff !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              overflow: hidden !important;
            }

            aside,
            nav,
            button,
            .no-print {
              display: none !important;
            }

            .print-shell {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
            }

            .print-doc {
              width: 100% !important;
              max-width: 100% !important;
              box-shadow: none !important;
              border: none !important;
              margin: 0 !important;
              padding: 0 !important;
              page-break-inside: avoid !important;
            }

            .print-section {
              border: 1px solid #d1d5db !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              margin-bottom: 8px !important;
              padding: 8px !important;
              page-break-inside: avoid !important;
            }

            .print-title {
              font-size: 18px !important;
              margin-bottom: 2px !important;
            }

            .print-subtitle {
              font-size: 11px !important;
              margin-bottom: 8px !important;
            }

            .print-grid {
              display: grid !important;
              grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
              gap: 6px !important;
              font-size: 11px !important;
            }

            .print-notes {
              font-size: 11px !important;
              margin-top: 6px !important;
            }

            table {
              width: 100% !important;
              border-collapse: collapse !important;
              table-layout: fixed !important;
            }

            th,
            td {
              border: 1px solid #d1d5db !important;
              padding: 4px 6px !important;
              font-size: 10px !important;
              line-height: 1.2 !important;
              word-break: break-word !important;
            }

            .print-totals-row {
              display: grid !important;
              grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
              gap: 6px !important;
              font-size: 11px !important;
            }

            .print-signatures {
              display: flex !important;
              justify-content: space-between !important;
              margin-top: 14px !important;
              font-size: 11px !important;
            }

            .print-signatures > div {
              width: 30% !important;
              text-align: center !important;
              padding-top: 16px !important;
              border-top: 1px solid #111 !important;
            }
          }
        `}</style>

        <div className="print-shell">
          <div className="bg-white rounded-xl shadow p-4 print-doc">
            <div className="flex items-center justify-between gap-3 flex-wrap no-print mb-4">
              <div>
                <h1 className="text-2xl font-bold">Transfer Challan</h1>
                <p className="text-sm text-gray-500">{header.challan_number}</p>
              </div>

              <div className="flex gap-2">
                <Link href="/stock/transfers" className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">
                  ← Back
                </Link>

                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
                >
                  Print
                </button>

                {String(header.status || "").toLowerCase() === "draft" && (
                  <>
                    <button
                      onClick={postChallan}
                      className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
                    >
                      Post
                    </button>

                    <button
                      onClick={cancelChallan}
                      className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="hidden print:block text-center mb-2">
              <div className="print-title font-bold">Transfer Challan</div>
              <div className="print-subtitle">{header.challan_number}</div>
            </div>

            <div className="bg-white rounded-xl shadow p-4 print-section">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Challan Details</h2>
                <div>{statusBadge(header.status)}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm print-grid">
                <div><b>Challan No:</b> {header.challan_number || "-"}</div>
                <div><b>Date:</b> {header.challan_date || "-"}</div>
                <div><b>From Branch:</b> {header.from_branch_name || "-"}</div>
                <div><b>To Branch:</b> {header.to_branch_name || "-"}</div>

                <div><b>Transporter:</b> {header.transporter_name || "-"}</div>
                <div><b>Vehicle No:</b> {header.vehicle_number || "-"}</div>
                <div><b>Driver:</b> {header.driver_name || "-"}</div>
                <div><b>Driver Mobile:</b> {header.driver_mobile || "-"}</div>

                <div><b>LR Number:</b> {header.lr_number || "-"}</div>
                <div><b>Total Vehicles:</b> {header.total_vehicles || 0}</div>
              </div>

              <div className="mt-3 text-sm space-y-1 print-notes">
                <div><b>Notes:</b> {header.notes || "-"}</div>
                <div><b>Remarks:</b> {header.remarks || "-"}</div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-4 print-section">
              <h2 className="text-lg font-semibold mb-3">Vehicles</h2>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 border-b text-left w-[8%]">Stock</th>
                      <th className="p-3 border-b text-left w-[22%]">Vehicle</th>
                      <th className="p-3 border-b text-left w-[10%]">Color</th>
                      <th className="p-3 border-b text-left w-[24%]">Chassis</th>
                      <th className="p-3 border-b text-left w-[22%]">Engine</th>
                      <th className="p-3 border-b text-right w-[14%]">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-gray-500">
                          No vehicles found
                        </td>
                      </tr>
                    ) : (
                      items.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-3 font-mono">{r.stock_item_id}</td>
                          <td className="p-3">{r.model_name || "-"} {r.variant_name || ""}</td>
                          <td className="p-3">{r.color || "-"}</td>
                          <td className="p-3 font-mono">{r.chassis_number || "-"}</td>
                          <td className="p-3 font-mono">{r.engine_number || "-"}</td>
                          <td className="p-3 text-right">₹ {money(r.line_amount || 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-4 print-section">
              <h2 className="text-lg font-semibold mb-3">Totals</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm print-totals-row">
                <div className="flex justify-between border-b pb-1">
                  <span>Subtotal</span>
                  <b>₹ {money(header.subtotal_amount || 0)}</b>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Freight</span>
                  <b>₹ {money(header.freight_amount || 0)}</b>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Loading</span>
                  <b>₹ {money(header.loading_amount || 0)}</b>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Unloading</span>
                  <b>₹ {money(header.unloading_amount || 0)}</b>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Other Cost</span>
                  <b>₹ {money(header.other_cost_amount || 0)}</b>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Discount</span>
                  <b>₹ {money(header.discount_amount || 0)}</b>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Tax</span>
                  <b>₹ {money(header.tax_amount || 0)}</b>
                </div>
                <div className="flex justify-between font-bold text-base pt-1">
                  <span>Grand Total</span>
                  <span>₹ {money(header.grand_total_amount || 0)}</span>
                </div>
              </div>

              <div className="hidden print:flex print-signatures">
                <div>Prepared By</div>
                <div>Received By</div>
                <div>Authorized Signatory</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}