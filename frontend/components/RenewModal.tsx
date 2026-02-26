"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  row: any | null;
  onSaved: () => void;
};

function addOneYearMinusOneDay(startYYYYMMDD: string) {
  if (!startYYYYMMDD) return "";

  // startYYYYMMDD = "YYYY-MM-DD"
  const [yStr, mStr, dStr] = startYYYYMMDD.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!y || !m || !d) return "";

  // Create "same date next year" in UTC (prevents timezone shift)
  const nextYearSameDayUTC = new Date(Date.UTC(y + 1, m - 1, d));

  // Subtract 1 day in UTC
  nextYearSameDayUTC.setUTCDate(nextYearSameDayUTC.getUTCDate() - 1);

  // Return YYYY-MM-DD
  return nextYearSameDayUTC.toISOString().slice(0, 10);
}


function onlyDigits10(input: string) {
  return (input || "").replace(/\D/g, "").slice(0, 10);
}

export default function RenewModal({ open, onClose, row, onSaved }: Props) {
  const [startDate, setStartDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [premium, setPremium] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    const today = new Date().toISOString().slice(0, 10);
    setStartDate(today);
    setPremium(row?.premium ?? "");
    setPhone(onlyDigits10(row?.phone ?? row?.mobile_number ?? ""));
  }, [open, row]);

  useEffect(() => {
    setExpiryDate(addOneYearMinusOneDay(startDate));
  }, [startDate]);

  const title = useMemo(() => {
    if (!row) return "Renew";
    return row.source === "SALE" ? "Renew (Sale Policy)" : "Renew (Renewal Policy)";
  }, [row]);

  if (!open || !row) return null;

  const save = async () => {
    const phoneClean = onlyDigits10(phone);
    if (phoneClean.length !== 10) {
      alert("phone must be exactly 10 digits (numbers only)");
      return;
    }
    if (!startDate) {
      alert("start_date is required");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        customer_name: row.customer_name,
        vehicle_no: row.vehicle_no,
        phone: phoneClean, // ✅ now user can correct it
        start_date: startDate,
        premium: premium ? Number(premium) : null,
      };

      if (row.source === "SALE") {
        await api.put(`/api/insurance/${row.id}`, payload);
      } else {
        await api.put(`/api/insurance-policies/${row.id}`, payload);
      }

      onSaved();
      onClose();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Renew failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button style={btnOutline} onClick={onClose}>X</button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={label}>Start Date *</div>
            <input style={input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div>
            <div style={label}>Expiry Date (auto)</div>
            <input style={{ ...input, background: "#f3f4f6" }} value={expiryDate} readOnly />
          </div>

          <div>
            <div style={label}>Phone (10 digits) *</div>
            <input
              style={input}
              value={phone}
              onChange={(e) => setPhone(onlyDigits10(e.target.value))}
              placeholder="Enter 10-digit mobile"
              inputMode="numeric"
            />
          </div>

          <div>
            <div style={label}>Premium</div>
            <input
              style={input}
              value={premium}
              onChange={(e) => setPremium(e.target.value)}
              placeholder="e.g. 1650"
              inputMode="decimal"
            />
          </div>

          <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#555" }}>
            Expiry is auto-calculated (Start + 1 year − 1 day). Database triggers also enforce it.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <button style={btnPrimary} disabled={saving} onClick={save}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button style={btnOutline} disabled={saving} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* styles */
const overlay: any = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 12,
  zIndex: 9999,
};
const modal: any = {
  background: "#fff",
  borderRadius: 12,
  width: 560,
  maxWidth: "100%",
  padding: 14,
  border: "1px solid #eee",
};
const input: any = {
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: "8px 10px",
  outline: "none",
  background: "#fff",
  width: "100%",
};
const label: any = {
  fontSize: 12,
  color: "#555",
  marginBottom: 6,
};
const btnOutline: any = {
  border: "1px solid #ccc",
  background: "#fff",
  padding: "8px 12px",
  borderRadius: 10,
  cursor: "pointer",
};
const btnPrimary: any = {
  border: "1px solid #dc2626",
  background: "#dc2626",
  color: "#fff",
  padding: "8px 12px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};
