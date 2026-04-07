"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";

type ChallanHeader = {
  id: number;
  challan_number: string;
  challan_date: string;
  from_branch_id?: number | null;
  to_branch_id?: number | null;
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
  model_id?: number | null;
  variant_id?: number | null;
  model_name?: string | null;
  variant_name?: string | null;
  color?: string | null;
  chassis_number?: string | null;
  engine_number?: string | null;
  unit_amount?: number | null;
  line_amount?: number | null;
};

type BranchRow = {
  id: number;
  branch_name: string;
};

type StockRow = {
  id: number;
  chassis_number?: string | null;
  engine_number?: string | null;
  model_name?: string | null;
  variant_name?: string | null;
  color?: string | null;
  purchase_price?: number | null;
  current_branch_id?: number | null;
  branch_name?: string | null;
};

function money(v: any) {
  const n = Number(v || 0);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function num(v: any) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
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
  const searchParams = useSearchParams();
  const id = params?.id;
  const mode = searchParams?.get("mode") || "";
  const shouldPrint = searchParams?.get("print") === "1";

  const [header, setHeader] = useState<ChallanHeader | null>(null);
  const [items, setItems] = useState<ChallanItem[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [savingHeader, setSavingHeader] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<number | null>(null);

  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [customAmounts, setCustomAmounts] = useState<Record<number, string>>({});

  const [form, setForm] = useState({
    challan_date: "",
    from_branch_id: "",
    to_branch_id: "",
    transporter_name: "",
    vehicle_number: "",
    driver_name: "",
    driver_mobile: "",
    lr_number: "",
    freight_amount: "",
    loading_amount: "",
    unloading_amount: "",
    other_cost_amount: "",
    discount_amount: "",
    tax_amount: "",
    notes: "",
    remarks: "",
  });

  async function loadBranches() {
    try {
      const res = await api.get("/api/branches");
      setBranches(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setBranches([]);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      const res = await api.get(`/api/stock-transfer-challans/${id}`);
      const hdr = res.data?.data?.header || null;
      const itm = Array.isArray(res.data?.data?.items) ? res.data.data.items : [];

      setHeader(hdr);
      setItems(itm);

      if (hdr) {
        setForm({
          challan_date: hdr.challan_date || "",
          from_branch_id: hdr.from_branch_id ? String(hdr.from_branch_id) : "",
          to_branch_id: hdr.to_branch_id ? String(hdr.to_branch_id) : "",
          transporter_name: hdr.transporter_name || "",
          vehicle_number: hdr.vehicle_number || "",
          driver_name: hdr.driver_name || "",
          driver_mobile: hdr.driver_mobile || "",
          lr_number: hdr.lr_number || "",
          freight_amount: String(hdr.freight_amount ?? ""),
          loading_amount: String(hdr.loading_amount ?? ""),
          unloading_amount: String(hdr.unloading_amount ?? ""),
          other_cost_amount: String(hdr.other_cost_amount ?? ""),
          discount_amount: String(hdr.discount_amount ?? ""),
          tax_amount: String(hdr.tax_amount ?? ""),
          notes: hdr.notes || "",
          remarks: hdr.remarks || "",
        });
      }
    } catch (e: any) {
      console.error("loadData error:", e);
      alert(e?.response?.data?.message || "Failed to load challan");
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailableStock() {
    if (!form.from_branch_id) {
      setStockRows([]);
      return;
    }

    try {
      setLoadingStock(true);
      const res = await api.get("/api/stock", {
        params: {
          status_code: "in_stock",
          branch_id: Number(form.from_branch_id),
          q: searchQ || undefined,
        },
      });
      setStockRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e: any) {
      console.error("loadAvailableStock error:", e);
      alert(e?.response?.data?.message || "Failed to load stock");
    } finally {
      setLoadingStock(false);
    }
  }

  async function saveHeaderChanges() {
    if (!header) return;
    if (!form.challan_date) return alert("Challan date is required");
    if (!form.from_branch_id) return alert("From branch is required");
    if (!form.to_branch_id) return alert("To branch is required");
    if (form.from_branch_id === form.to_branch_id) {
      return alert("From and To branch cannot be same");
    }

    try {
      setSavingHeader(true);

      await api.put(`/api/stock-transfer-challans/${id}`, {
        challan_date: form.challan_date,
        from_branch_id: Number(form.from_branch_id),
        to_branch_id: Number(form.to_branch_id),
        transporter_name: form.transporter_name || null,
        vehicle_number: form.vehicle_number || null,
        driver_name: form.driver_name || null,
        driver_mobile: form.driver_mobile || null,
        lr_number: form.lr_number || null,
        freight_amount: num(form.freight_amount),
        loading_amount: num(form.loading_amount),
        unloading_amount: num(form.unloading_amount),
        other_cost_amount: num(form.other_cost_amount),
        discount_amount: num(form.discount_amount),
        tax_amount: num(form.tax_amount),
        notes: form.notes || null,
        remarks: form.remarks || null,
      });

      await loadData();
      await loadAvailableStock();
      alert("Challan updated successfully");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to update challan");
    } finally {
      setSavingHeader(false);
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

  async function addVehicleFromRow(row: StockRow) {
    try {
      setAddingItem(true);

      const payload: Record<string, any> = {
        stock_item_id: row.id,
      };

      const amount = customAmounts[row.id];
      if (String(amount || "").trim() !== "") {
        payload.unit_amount = Number(amount);
      }

      await api.post(`/api/stock-transfer-challans/${id}/items`, payload);

      setCustomAmounts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });

      await loadData();
      await loadAvailableStock();
      alert("Vehicle added successfully");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to add vehicle");
    } finally {
      setAddingItem(false);
    }
  }

  async function removeItem(itemId: number) {
    if (!window.confirm("Remove this vehicle from challan?")) return;

    try {
      setRemovingItemId(itemId);
      await api.delete(`/api/stock-transfer-challans/${id}/items/${itemId}`);
      await loadData();
      await loadAvailableStock();
      alert("Vehicle removed successfully");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to remove vehicle");
    } finally {
      setRemovingItemId(null);
    }
  }

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isDraft = useMemo(
    () => String(header?.status || "").toLowerCase() === "draft",
    [header?.status]
  );

  const isEditMode = isDraft && mode === "edit";

  useEffect(() => {
    if (!isEditMode) return;
    loadAvailableStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, form.from_branch_id, searchQ]);

  useEffect(() => {
    if (!loading && header && shouldPrint) {
      const t = setTimeout(() => {
        window.print();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [loading, header, shouldPrint]);

  const filteredStockRows = useMemo(() => {
    const selectedIds = new Set(items.map((it) => Number(it.stock_item_id)));
    return stockRows.filter((row) => !selectedIds.has(Number(row.id)));
  }, [stockRows, items]);

  const liveSubtotal = useMemo(() => {
    return items.reduce((sum, r) => sum + num(r.line_amount), 0);
  }, [items]);

  const liveGrandTotal = useMemo(() => {
    return (
      liveSubtotal +
      num(form.freight_amount) +
      num(form.loading_amount) +
      num(form.unloading_amount) +
      num(form.other_cost_amount) +
      num(form.tax_amount) -
      num(form.discount_amount)
    );
  }, [
    liveSubtotal,
    form.freight_amount,
    form.loading_amount,
    form.unloading_amount,
    form.other_cost_amount,
    form.tax_amount,
    form.discount_amount,
  ]);

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
            input,
            textarea,
            select,
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

              <div className="flex gap-2 flex-wrap">
                <Link
                  href="/stock/transfers"
                  className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
                >
                  ← Back
                </Link>

                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
                >
                  Print
                </button>

                {isEditMode && (
                  <>
                    <button
                      onClick={saveHeaderChanges}
                      disabled={savingHeader}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingHeader ? "Saving..." : "Save Changes"}
                    </button>

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

              {!isEditMode ? (
                <>
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
                </>
              ) : (
                <div className="space-y-4 no-print">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Challan Number
                      </label>
                      <input
                        value={header.challan_number || ""}
                        readOnly
                        className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Challan Date
                      </label>
                      <input
                        type="date"
                        value={form.challan_date}
                        onChange={(e) => setForm((p) => ({ ...p, challan_date: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        From Branch
                      </label>
                      <select
                        value={form.from_branch_id}
                        onChange={(e) => setForm((p) => ({ ...p, from_branch_id: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">Select From Branch</option>
                        {branches.map((b) => (
                          <option key={b.id} value={String(b.id)}>
                            {b.branch_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        To Branch
                      </label>
                      <select
                        value={form.to_branch_id}
                        onChange={(e) => setForm((p) => ({ ...p, to_branch_id: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">Select To Branch</option>
                        {branches
                          .filter((b) => String(b.id) !== String(form.from_branch_id || ""))
                          .map((b) => (
                            <option key={b.id} value={String(b.id)}>
                              {b.branch_name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Transporter
                      </label>
                      <input
                        value={form.transporter_name}
                        onChange={(e) => setForm((p) => ({ ...p, transporter_name: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vehicle No
                      </label>
                      <input
                        value={form.vehicle_number}
                        onChange={(e) => setForm((p) => ({ ...p, vehicle_number: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Driver Name
                      </label>
                      <input
                        value={form.driver_name}
                        onChange={(e) => setForm((p) => ({ ...p, driver_name: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Driver Mobile
                      </label>
                      <input
                        value={form.driver_mobile}
                        onChange={(e) => setForm((p) => ({ ...p, driver_mobile: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        LR Number
                      </label>
                      <input
                        value={form.lr_number}
                        onChange={(e) => setForm((p) => ({ ...p, lr_number: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Freight
                      </label>
                      <input
                        type="number"
                        value={form.freight_amount}
                        onChange={(e) => setForm((p) => ({ ...p, freight_amount: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Loading
                      </label>
                      <input
                        type="number"
                        value={form.loading_amount}
                        onChange={(e) => setForm((p) => ({ ...p, loading_amount: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unloading
                      </label>
                      <input
                        type="number"
                        value={form.unloading_amount}
                        onChange={(e) => setForm((p) => ({ ...p, unloading_amount: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Other Cost
                      </label>
                      <input
                        type="number"
                        value={form.other_cost_amount}
                        onChange={(e) => setForm((p) => ({ ...p, other_cost_amount: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Discount
                      </label>
                      <input
                        type="number"
                        value={form.discount_amount}
                        onChange={(e) => setForm((p) => ({ ...p, discount_amount: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tax
                      </label>
                      <input
                        type="number"
                        value={form.tax_amount}
                        onChange={(e) => setForm((p) => ({ ...p, tax_amount: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        value={form.notes}
                        onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                        rows={2}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Remarks
                      </label>
                      <textarea
                        value={form.remarks}
                        onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                        rows={2}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isEditMode && (
              <div className="bg-white rounded-xl shadow p-4 mb-4 no-print space-y-4">
                <h2 className="text-lg font-semibold">Add Vehicle to Draft</h2>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Search by chassis / engine / model"
                    className="px-3 py-2 border rounded-lg md:col-span-3"
                  />

                  <button
                    type="button"
                    onClick={loadAvailableStock}
                    className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
                  >
                    Refresh
                  </button>
                </div>

                {!form.from_branch_id ? (
                  <div className="text-sm text-amber-700">Select From Branch first.</div>
                ) : loadingStock ? (
                  <div className="text-sm text-slate-500">Loading stock...</div>
                ) : (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3 border-b text-left">Stock</th>
                          <th className="p-3 border-b text-left">Vehicle</th>
                          <th className="p-3 border-b text-left">Color</th>
                          <th className="p-3 border-b text-left">Chassis</th>
                          <th className="p-3 border-b text-left">Engine</th>
                          <th className="p-3 border-b text-left">Amount</th>
                          <th className="p-3 border-b text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStockRows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-4 text-slate-500">
                              No stock available
                            </td>
                          </tr>
                        ) : (
                          filteredStockRows.map((row) => (
                            <tr key={row.id} className="border-t">
                              <td className="p-3 font-mono">{row.id}</td>
                              <td className="p-3">
                                {row.model_name || "-"} {row.variant_name || ""}
                              </td>
                              <td className="p-3">{row.color || "-"}</td>
                              <td className="p-3 font-mono">{row.chassis_number || "-"}</td>
                              <td className="p-3 font-mono">{row.engine_number || "-"}</td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  value={customAmounts[row.id] || ""}
                                  onChange={(e) =>
                                    setCustomAmounts((prev) => ({
                                      ...prev,
                                      [row.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Optional amount"
                                  className="w-36 px-2 py-1 border rounded"
                                />
                              </td>
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => addVehicleFromRow(row)}
                                  disabled={addingItem}
                                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  Add
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-xl shadow p-4 print-section">
              <h2 className="text-lg font-semibold mb-3">Vehicles</h2>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 border-b text-left w-[8%]">Stock</th>
                      <th className="p-3 border-b text-left w-[20%]">Vehicle</th>
                      <th className="p-3 border-b text-left w-[10%]">Color</th>
                      <th className="p-3 border-b text-left w-[22%]">Chassis</th>
                      <th className="p-3 border-b text-left w-[20%]">Engine</th>
                      <th className="p-3 border-b text-right w-[12%]">Amount</th>
                      {isEditMode && (
                        <th className="p-3 border-b text-center w-[8%] no-print">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={isEditMode ? 7 : 6} className="p-4 text-gray-500">
                          No vehicles found
                        </td>
                      </tr>
                    ) : (
                      items.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-3 font-mono">{r.stock_item_id}</td>
                          <td className="p-3">
                            {r.model_name || "-"} {r.variant_name || ""}
                          </td>
                          <td className="p-3">{r.color || "-"}</td>
                          <td className="p-3 font-mono">{r.chassis_number || "-"}</td>
                          <td className="p-3 font-mono">{r.engine_number || "-"}</td>
                          <td className="p-3 text-right">₹ {money(r.line_amount || 0)}</td>
                          {isEditMode && (
                            <td className="p-3 text-center no-print">
                              <button
                                type="button"
                                onClick={() => removeItem(r.id)}
                                disabled={removingItemId === r.id}
                                className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                              >
                                {removingItemId === r.id ? "Removing..." : "Remove"}
                              </button>
                            </td>
                          )}
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
                  <b>₹ {money(isEditMode ? liveSubtotal : header.subtotal_amount || 0)}</b>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Freight</span>
                  <b>₹ {money(isEditMode ? form.freight_amount : header.freight_amount || 0)}</b>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Loading</span>
                  <b>₹ {money(isEditMode ? form.loading_amount : header.loading_amount || 0)}</b>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Unloading</span>
                  <b>₹ {money(isEditMode ? form.unloading_amount : header.unloading_amount || 0)}</b>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Other Cost</span>
                  <b>₹ {money(isEditMode ? form.other_cost_amount : header.other_cost_amount || 0)}</b>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Discount</span>
                  <b>₹ {money(isEditMode ? form.discount_amount : header.discount_amount || 0)}</b>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Tax</span>
                  <b>₹ {money(isEditMode ? form.tax_amount : header.tax_amount || 0)}</b>
                </div>
                <div className="flex justify-between font-bold text-base pt-1">
                  <span>Grand Total</span>
                  <span>₹ {money(isEditMode ? liveGrandTotal : header.grand_total_amount || 0)}</span>
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