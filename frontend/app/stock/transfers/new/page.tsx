"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";

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

type SelectedStockRow = StockRow & {
  unit_amount: string;
};

function money(v: any) {
  const n = Number(v || 0);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function num(v: string) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

export default function NewStockTransferChallanPage() {
  const router = useRouter();

  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<SelectedStockRow[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [saving, setSaving] = useState(false);

  const [challanNumber, setChallanNumber] = useState("");
  const [challanDate, setChallanDate] = useState(today());

  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");

  const [transporterName, setTransporterName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverMobile, setDriverMobile] = useState("");
  const [lrNumber, setLrNumber] = useState("");

  const [freightAmount, setFreightAmount] = useState("");
  const [loadingAmount, setLoadingAmount] = useState("");
  const [unloadingAmount, setUnloadingAmount] = useState("");
  const [otherCostAmount, setOtherCostAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");

  const [notes, setNotes] = useState("");
  const [remarks, setRemarks] = useState("");

  const [searchQ, setSearchQ] = useState("");

  async function loadBranches() {
    try {
      const res = await api.get("/api/branches");
      setBranches(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setBranches([]);
    }
  }

  async function loadNextChallanNumber(dateValue: string) {
    try {
      const res = await api.get("/api/stock-transfer-challans/next-number", {
        params: { challan_date: dateValue },
      });
      setChallanNumber(res.data?.data?.challan_number || "");
    } catch (e) {
      console.error("loadNextChallanNumber error:", e);
      setChallanNumber("");
    }
  }

  async function loadStock() {
    if (!fromBranchId) {
      setStockRows([]);
      return;
    }

    try {
      setLoadingStock(true);
      const res = await api.get("/api/stock", {
        params: {
          status_code: "in_stock",
          branch_id: Number(fromBranchId),
          q: searchQ || undefined,
        },
      });
      setStockRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e: any) {
      console.error("loadStock error:", e);
      alert(e?.response?.data?.message || "Failed to load stock");
    } finally {
      setLoadingStock(false);
    }
  }

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (challanDate) {
      loadNextChallanNumber(challanDate);
    }
  }, [challanDate]);

  useEffect(() => {
    loadStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromBranchId, searchQ]);

  useEffect(() => {
    setSelectedRows([]);
  }, [fromBranchId]);

  const availableRows = useMemo(() => {
    const selectedIds = new Set(selectedRows.map((r) => Number(r.id)));
    return stockRows.filter((r) => !selectedIds.has(Number(r.id)));
  }, [stockRows, selectedRows]);

  const subtotalAmount = useMemo(() => {
    return selectedRows.reduce((sum, r) => sum + num(r.unit_amount), 0);
  }, [selectedRows]);

  const grandTotal = useMemo(() => {
    return (
      subtotalAmount +
      num(freightAmount) +
      num(loadingAmount) +
      num(unloadingAmount) +
      num(otherCostAmount) +
      num(taxAmount) -
      num(discountAmount)
    );
  }, [
    subtotalAmount,
    freightAmount,
    loadingAmount,
    unloadingAmount,
    otherCostAmount,
    taxAmount,
    discountAmount,
  ]);

  function addItem(row: StockRow) {
    setSelectedRows((prev) => [
      ...prev,
      {
        ...row,
        unit_amount: "",
      },
    ]);
  }

  function removeItem(id: number) {
    setSelectedRows((prev) => prev.filter((r) => Number(r.id) !== Number(id)));
  }

  function updateItemAmount(id: number, value: string) {
    setSelectedRows((prev) =>
      prev.map((r) =>
        Number(r.id) === Number(id)
          ? { ...r, unit_amount: value }
          : r
      )
    );
  }

  async function saveDraft() {
    if (!challanDate) return alert("Select challan date");
    if (!fromBranchId) return alert("Select from branch");
    if (!toBranchId) return alert("Select to branch");
    if (fromBranchId === toBranchId) return alert("From and To branch cannot be same");
    if (!selectedRows.length) return alert("Add at least one stock item");

    const invalidAmountRow = selectedRows.find((r) => num(r.unit_amount) <= 0);
    if (invalidAmountRow) {
      return alert(`Enter valid amount for stock item ${invalidAmountRow.id}`);
    }

    try {
      setSaving(true);

      const createRes = await api.post("/api/stock-transfer-challans", {
        challan_number: challanNumber || null,
        challan_date: challanDate,
        from_branch_id: Number(fromBranchId),
        to_branch_id: Number(toBranchId),
        transporter_name: transporterName || null,
        vehicle_number: vehicleNumber || null,
        driver_name: driverName || null,
        driver_mobile: driverMobile || null,
        lr_number: lrNumber || null,
        notes: notes || null,
        remarks: remarks || null,
        freight_amount: num(freightAmount),
        loading_amount: num(loadingAmount),
        unloading_amount: num(unloadingAmount),
        other_cost_amount: num(otherCostAmount),
        discount_amount: num(discountAmount),
        tax_amount: num(taxAmount),
      });

      const challanId = createRes.data?.data?.id;
      if (!challanId) throw new Error("Challan not created");

      for (const row of selectedRows) {
        await api.post(`/api/stock-transfer-challans/${challanId}/items`, {
          stock_item_id: row.id,
          unit_amount: num(row.unit_amount),
        });
      }

      alert("Draft challan created successfully");
      router.push(`/stock/transfers/${challanId}`);
    } catch (e: any) {
      console.error("saveDraft error:", e);
      alert(e?.response?.data?.message || e?.message || "Failed to create challan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGuard>
      <div className="p-6 space-y-6">
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">New Stock Transfer Challan</h1>
              <p className="text-sm text-gray-500">
                Create draft challan and add multiple stock vehicles
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/stock/transfers"
                className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
              >
                ← Back
              </Link>
              <button
                onClick={saveDraft}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow space-y-4">
          <h2 className="text-lg font-semibold">Challan Header</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Challan Number
              </label>
              <input
                value={challanNumber}
                readOnly
                className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Challan Date
              </label>
              <input
                type="date"
                value={challanDate}
                onChange={(e) => setChallanDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Branch
              </label>
              <select
                value={fromBranchId}
                onChange={(e) => setFromBranchId(e.target.value)}
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
                value={toBranchId}
                onChange={(e) => setToBranchId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select To Branch</option>
                {branches
                  .filter((b) => String(b.id) !== String(fromBranchId || ""))
                  .map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.branch_name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow space-y-4">
          <h2 className="text-lg font-semibold">Transport Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transporter Name
              </label>
              <input
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                placeholder="Transporter Name"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle Number
              </label>
              <input
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="Vehicle Number"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Driver Name
              </label>
              <input
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Driver Name"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Driver Mobile
              </label>
              <input
                value={driverMobile}
                onChange={(e) => setDriverMobile(e.target.value)}
                placeholder="Driver Mobile"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LR Number
              </label>
              <input
                value={lrNumber}
                onChange={(e) => setLrNumber(e.target.value)}
                placeholder="LR Number"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow space-y-4">
          <h2 className="text-lg font-semibold">Charges & Notes</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Freight Amount
              </label>
              <input
                type="number"
                value={freightAmount}
                onChange={(e) => setFreightAmount(e.target.value)}
                placeholder="Enter freight amount"
                className="w-full px-3 py-2 border rounded-lg text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Loading Amount
              </label>
              <input
                type="number"
                value={loadingAmount}
                onChange={(e) => setLoadingAmount(e.target.value)}
                placeholder="Enter loading amount"
                className="w-full px-3 py-2 border rounded-lg text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unloading Amount
              </label>
              <input
                type="number"
                value={unloadingAmount}
                onChange={(e) => setUnloadingAmount(e.target.value)}
                placeholder="Enter unloading amount"
                className="w-full px-3 py-2 border rounded-lg text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Other Cost
              </label>
              <input
                type="number"
                value={otherCostAmount}
                onChange={(e) => setOtherCostAmount(e.target.value)}
                placeholder="Enter other cost"
                className="w-full px-3 py-2 border rounded-lg text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Amount
              </label>
              <input
                type="number"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="Enter discount amount"
                className="w-full px-3 py-2 border rounded-lg text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Amount
              </label>
              <input
                type="number"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
                placeholder="Enter tax amount"
                className="w-full px-3 py-2 border rounded-lg text-black"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter notes"
                className="w-full px-3 py-2 border rounded-lg text-black"
                rows={2}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks"
                className="w-full px-3 py-2 border rounded-lg text-black"
                rows={2}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded border bg-gray-50">
              <div className="text-sm text-gray-500">Total Vehicles</div>
              <div className="text-xl font-semibold text-black">{selectedRows.length}</div>
            </div>

            <div className="p-4 rounded border bg-gray-50">
              <div className="text-sm text-gray-500">Subtotal</div>
              <div className="text-xl font-semibold text-black">₹ {money(subtotalAmount)}</div>
            </div>

            <div className="p-4 rounded border bg-gray-50">
              <div className="text-sm text-gray-500">Grand Total</div>
              <div className="text-xl font-semibold text-black">₹ {money(grandTotal)}</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow space-y-4">
          <h2 className="text-lg font-semibold">Stock Selection</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search stock by chassis / engine / model"
              className="px-3 py-2 border rounded-lg md:col-span-3"
            />

            <button
              onClick={loadStock}
              className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          {!fromBranchId ? (
            <div className="text-sm text-amber-700">Select From Branch first.</div>
          ) : loadingStock ? (
            <div className="text-sm text-gray-500">Loading stock...</div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 border-b text-left">Stock</th>
                    <th className="p-3 border-b text-left">Vehicle</th>
                    <th className="p-3 border-b text-left">Chassis</th>
                    <th className="p-3 border-b text-left">Engine</th>
                    <th className="p-3 border-b text-left">Amount</th>
                    <th className="p-3 border-b text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {availableRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-gray-500">
                        No stock available
                      </td>
                    </tr>
                  ) : (
                    availableRows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-3 font-mono">{r.id}</td>
                        <td className="p-3">
                          {r.model_name || "-"} {r.variant_name || ""}
                        </td>
                        <td className="p-3 font-mono">{r.chassis_number || "-"}</td>
                        <td className="p-3 font-mono">{r.engine_number || "-"}</td>
                        <td className="p-3 text-black font-medium">Set manually after add</td>
                        <td className="p-3">
                          <button
                            onClick={() => addItem(r)}
                            className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
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

        <div className="bg-white p-6 rounded-xl shadow space-y-4">
          <h2 className="text-lg font-semibold">Selected Vehicles</h2>

          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 border-b text-left">Stock</th>
                  <th className="p-3 border-b text-left">Vehicle</th>
                  <th className="p-3 border-b text-left">Chassis</th>
                  <th className="p-3 border-b text-left">Engine</th>
                  <th className="p-3 border-b text-left">Amount</th>
                  <th className="p-3 border-b text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {selectedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-gray-500">
                      No vehicle selected
                    </td>
                  </tr>
                ) : (
                  selectedRows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-3 font-mono">{r.id}</td>
                      <td className="p-3">
                        {r.model_name || "-"} {r.variant_name || ""}
                      </td>
                      <td className="p-3 font-mono">{r.chassis_number || "-"}</td>
                      <td className="p-3 font-mono">{r.engine_number || "-"}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={r.unit_amount}
                          onChange={(e) => updateItemAmount(r.id, e.target.value)}
                          placeholder="Enter vehicle amount"
                          className="w-40 px-2 py-1 border rounded text-black font-medium"
                        />
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => removeItem(r.id)}
                          className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}