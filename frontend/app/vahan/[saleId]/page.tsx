"use client";

import React, { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import { useParams, useRouter } from "next/navigation";

function formatStatus(status: string | null | undefined) {
  switch (String(status || "").toLowerCase()) {
    case "pending_insurance":
      return "Pending Insurance";
    case "ready_for_vahan":
      return "Pending Fill";
    case "payment_pending":
      return "Pending Payment";
    case "payment_done":
      return "Paid";
    case "completed":
      return "Completed";
    default:
      return "-";
  }
}

function ymd(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateOnly(s?: string | null) {
  if (!s) return null;

  const raw = String(s).trim();

  // YYYY-MM-DD or ISO string
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const t = raw.slice(0, 10);
    const parts = t.split("-");
    if (parts.length !== 3) return null;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  // DD/MM/YYYY
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const d = Number(slash[1]);
    const m = Number(slash[2]);
    const y = Number(slash[3]);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  // DD-MM-YYYY
  const dash = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dash) {
    const d = Number(dash[1]);
    const m = Number(dash[2]);
    const y = Number(dash[3]);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  return null;
}

function normalizeToYmd(value?: string | null) {
  const d = parseDateOnly(value);
  return d ? ymd(d) : "";
}

function formatDate(value: any) {
  const d = parseDateOnly(value);
  if (!d) return value ? String(value).slice(0, 10) : "-";

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTodayYmd() {
  return ymd(new Date());
}

function getYesterdayYmd() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return ymd(d);
}

function getEffectiveDefaultPaymentDate(fillDate?: string) {
  const yesterday = parseDateOnly(getYesterdayYmd());
  const fill = parseDateOnly(fillDate || "");
  if (!yesterday) return fillDate || "";
  if (!fill) return ymd(yesterday);
  return yesterday < fill ? ymd(fill) : ymd(yesterday);
}

function computePenaltyPreview(saleDate?: string, paymentDate?: string) {
  const s = parseDateOnly(saleDate || "");
  const p = parseDateOnly(paymentDate || "");
  if (!s || !p) return null;

  const penaltyStart = new Date(s);
  penaltyStart.setDate(penaltyStart.getDate() + 7); // 1 Jan sale -> penalty from 8 Jan

  return {
    penaltyDue: p >= penaltyStart,
    penaltyStartDate: ymd(penaltyStart),
  };
}

export default function VahanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const saleId = String(params?.saleId || "");

  const user = getUser();
  const role = String(user?.role || "").toLowerCase();
  const isOwnerAdmin = role === "owner" || role === "admin";

  const [loading, setLoading] = useState(true);
  const [savingForm, setSavingForm] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [completing, setCompleting] = useState(false);

  const [sale, setSale] = useState<any>(null);
  const [vahan, setVahan] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    application_number: "",
    vahan_fill_date: "",
    payment_amount: "",
  });

  const [paymentData, setPaymentData] = useState({
    vahan_payment_date: "",
    rto_number: "",
    penalty_amount: "",
    remarks: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/vahan/${saleId}`);

      const loadedSale = res.data?.sale || null;
      const loadedVahan = res.data?.vahan || null;
      const loadedSubmission = res.data?.submission || null;

      setSale(loadedSale);
      setVahan(loadedVahan);
      setSubmission(loadedSubmission);

      const loadedFillDate = normalizeToYmd(loadedSubmission?.vahan_fill_date);

      setFormData({
        application_number: loadedSubmission?.application_number || "",
        vahan_fill_date: loadedFillDate,
        payment_amount: String(loadedSubmission?.payment_amount ?? ""),
      });

      const loadedPaymentDate = normalizeToYmd(loadedSubmission?.vahan_payment_date);

      setPaymentData({
        vahan_payment_date:
          loadedPaymentDate || getEffectiveDefaultPaymentDate(loadedFillDate),
        rto_number: loadedSubmission?.rto_number || "",
        penalty_amount: String(loadedSubmission?.penalty_amount ?? ""),
        remarks: loadedSubmission?.remarks || "",
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load file");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (saleId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  useEffect(() => {
    if (!formData.vahan_fill_date) return;

    setPaymentData((prev) => {
      if (prev.vahan_payment_date) {
        const p = parseDateOnly(prev.vahan_payment_date);
        const f = parseDateOnly(formData.vahan_fill_date);
        if (p && f && p < f) {
          return {
            ...prev,
            vahan_payment_date: formData.vahan_fill_date,
          };
        }
        return prev;
      }

      return {
        ...prev,
        vahan_payment_date: getEffectiveDefaultPaymentDate(formData.vahan_fill_date),
      };
    });
  }, [formData.vahan_fill_date]);

  async function saveForm() {
    setSavingForm(true);
    setError(null);
    try {
      await api.put(`/api/vahan/${saleId}/form`, {
        ...formData,
        vahan_fill_date: normalizeToYmd(formData.vahan_fill_date),
      });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save application");
    } finally {
      setSavingForm(false);
    }
  }

  async function savePayment() {
    setSavingPayment(true);
    setError(null);
    try {
      await api.put(`/api/vahan/${saleId}/payment`, {
        ...paymentData,
        vahan_payment_date: normalizeToYmd(paymentData.vahan_payment_date),
      });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save payment");
    } finally {
      setSavingPayment(false);
    }
  }

  async function completeVahan() {
    setCompleting(true);
    setError(null);
    try {
      await api.post(`/api/vahan/${saleId}/complete`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to complete Vahan");
    } finally {
      setCompleting(false);
    }
  }

  const canOpenPayment =
    !!formData.application_number && !!formData.vahan_fill_date;

  const isCompleted =
    String(vahan?.current_status || "").toLowerCase() === "completed" ||
    Number(vahan?.is_completed || 0) === 1;

  const isReadOnlyCompleted = isCompleted && !isOwnerAdmin;

  const penaltyPreview = useMemo(
    () => computePenaltyPreview(sale?.sale_date, paymentData.vahan_payment_date),
    [sale?.sale_date, paymentData.vahan_payment_date]
  );

  const todayYmd = getTodayYmd();

  return (
    <AuthGuard roles={["owner", "admin", "manager", "vahan", "sales", "rc"]}>
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Vahan File #{saleId}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Status: <strong>{formatStatus(vahan?.current_status)}</strong>
            </p>
          </div>

          <button
            onClick={() => router.push("/vahan")}
            className="px-4 py-2 border rounded bg-white"
          >
            Back
          </button>
        </div>

        {loading && <p>Loading...</p>}
        {error && <p className="text-red-600 mb-4">{error}</p>}

        {!loading && sale && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded shadow p-4">
              <h2 className="text-xl font-semibold mb-4">Sale Details</h2>
              <div className="space-y-2 text-sm">
                <p><strong>Customer:</strong> {sale.customer_name || "-"}</p>
                <p><strong>Mobile:</strong> {sale.mobile_number || "-"}</p>
                <p><strong>Invoice:</strong> {sale.invoice_number || "-"}</p>
                <p><strong>Sale Date:</strong> {formatDate(sale.sale_date)}</p>
                <p>
                  <strong>Vehicle:</strong>{" "}
                  {[sale.vehicle_make, sale.vehicle_model].filter(Boolean).join(" ") || "-"}
                </p>
                <p><strong>Chassis:</strong> {sale.chassis_number || "-"}</p>
                <p><strong>Engine:</strong> {sale.engine_number || "-"}</p>
                <p><strong>Insurance Done:</strong> {Number(vahan?.insurance_done) ? "Yes" : "No"}</p>
              </div>
            </div>

            <div className="bg-white rounded shadow p-4">
              <h2 className="text-xl font-semibold mb-4">Application Fill</h2>

              {isCompleted && (
                <p className="text-sm text-green-700 font-medium mb-3">
                  {isOwnerAdmin
                    ? "This VAHAN file is completed. Owner/Admin can still edit it."
                    : "This VAHAN file is completed."}
                </p>
              )}

              <div className="space-y-3">
                <input
                  value={formData.application_number}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      application_number: e.target.value,
                    })
                  }
                  placeholder="Application Number"
                  className="w-full border rounded px-3 py-2"
                  disabled={isReadOnlyCompleted}
                />

                <input
                  type="date"
                  value={formData.vahan_fill_date}
                  max={todayYmd}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vahan_fill_date: normalizeToYmd(e.target.value),
                    })
                  }
                  className="w-full border rounded px-3 py-2"
                  disabled={isReadOnlyCompleted}
                />

                <input
                  value={formData.payment_amount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      payment_amount: e.target.value,
                    })
                  }
                  placeholder="Payment Amount"
                  className="w-full border rounded px-3 py-2"
                  disabled={isReadOnlyCompleted}
                />

                <button
                  onClick={saveForm}
                  disabled={savingForm || isReadOnlyCompleted}
                  className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                >
                  {savingForm ? "Saving..." : "Save Application"}
                </button>
              </div>
            </div>

            <div className="bg-white rounded shadow p-4 lg:col-span-2">
              <h2 className="text-xl font-semibold mb-4">Payment</h2>

              {!canOpenPayment && !isCompleted && (
                <p className="text-sm text-orange-600 mb-3">
                  First save application number and fill date, then payment section will open.
                </p>
              )}

              {isCompleted && (
                <p className="text-sm text-green-700 font-medium mb-3">
                  {isOwnerAdmin
                    ? "This file is completed, but Owner/Admin can still edit it."
                    : "Payment and completion are locked because this file is already completed."}
                </p>
              )}

              <p className="text-sm text-gray-600 mb-3">
                Payment date cannot be before fill date. Penalty starts from the 8th day after sale date.
              </p>

              {penaltyPreview && (
                <p className="text-sm mb-3">
                  <strong>Penalty Start Date:</strong> {formatDate(penaltyPreview.penaltyStartDate)}{" "}
                  | <strong>Penalty Due:</strong> {penaltyPreview.penaltyDue ? "Yes" : "No"}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="date"
                  value={paymentData.vahan_payment_date}
                  min={formData.vahan_fill_date || undefined}
                  max={todayYmd}
                  onChange={(e) =>
                    setPaymentData({
                      ...paymentData,
                      vahan_payment_date: normalizeToYmd(e.target.value),
                    })
                  }
                  className="w-full border rounded px-3 py-2"
                  disabled={!canOpenPayment || isReadOnlyCompleted}
                />

                <input
                  value={paymentData.rto_number}
                  onChange={(e) =>
                    setPaymentData({
                      ...paymentData,
                      rto_number: e.target.value,
                    })
                  }
                  placeholder="RTO Number"
                  className="w-full border rounded px-3 py-2"
                  disabled={!canOpenPayment || isReadOnlyCompleted}
                />

                <input
                  value={paymentData.penalty_amount}
                  onChange={(e) =>
                    setPaymentData({
                      ...paymentData,
                      penalty_amount: e.target.value,
                    })
                  }
                  placeholder="Penalty Amount"
                  className="w-full border rounded px-3 py-2"
                  disabled={!canOpenPayment || isReadOnlyCompleted}
                />

                <input
                  value={paymentData.remarks}
                  onChange={(e) =>
                    setPaymentData({
                      ...paymentData,
                      remarks: e.target.value,
                    })
                  }
                  placeholder="Remarks"
                  className="w-full border rounded px-3 py-2"
                  disabled={!canOpenPayment || isReadOnlyCompleted}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={savePayment}
                  disabled={!canOpenPayment || savingPayment || isReadOnlyCompleted}
                  className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
                >
                  {savingPayment ? "Saving..." : "Mark Payment Done"}
                </button>

                <button
                  onClick={completeVahan}
                  disabled={
                    Number(submission?.payment_done || 0) !== 1 ||
                    completing ||
                    isReadOnlyCompleted
                  }
                  className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
                >
                  {completing ? "Completing..." : "Complete Vahan"}
                </button>
              </div>

              <div className="mt-4 text-sm text-gray-700 space-y-1">
                <p><strong>Saved Fill Date:</strong> {formatDate(submission?.vahan_fill_date)}</p>
                <p><strong>Payment Done:</strong> {Number(submission?.payment_done || 0) ? "Yes" : "No"}</p>
                <p><strong>Saved Payment Date:</strong> {formatDate(submission?.vahan_payment_date)}</p>
                <p><strong>Saved RTO Number:</strong> {submission?.rto_number || "-"}</p>
                <p><strong>Penalty Due:</strong> {Number(submission?.penalty_due || 0) ? "Yes" : "No"}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}