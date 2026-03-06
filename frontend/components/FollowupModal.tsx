"use client";
import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function FollowupModal({
  open,
  onClose,
  row,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  row: any | null;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [f1d, setF1d] = useState("");
  const [f1r, setF1r] = useState("");
  const [f2d, setF2d] = useState("");
  const [f2r, setF2r] = useState("");
  const [f3d, setF3d] = useState("");
  const [f3r, setF3r] = useState("");

  useEffect(() => {
    if (!open || !row) return;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/insurance-followup/${row.source}/${row.id}`);
        const d = res.data?.data || {};
        setF1d(d.followup1_date ? String(d.followup1_date).slice(0, 10) : "");
        setF1r(d.followup1_remark || "");
        setF2d(d.followup2_date ? String(d.followup2_date).slice(0, 10) : "");
        setF2r(d.followup2_remark || "");
        setF3d(d.followup3_date ? String(d.followup3_date).slice(0, 10) : "");
        setF3r(d.followup3_remark || "");
      } catch (e: any) {
        alert(e?.response?.data?.message || e?.message || "Failed to load followups");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, row]);

  if (!open || !row) return null;

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/api/insurance-followup/${row.source}/${row.id}`, {
        followup1_date: f1d || null,
        followup1_remark: f1r || null,
        followup2_date: f2d || null,
        followup2_remark: f2r || null,
        followup3_date: f3d || null,
        followup3_remark: f3r || null,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Follow-up Timeline</h3>
          <button style={btnOutline} onClick={onClose}>X</button>
        </div>

        {loading ? (
          <div style={{ padding: 12 }}>Loading...</div>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <TimelineBlock title="Follow-up 1" date={f1d} setDate={setF1d} remark={f1r} setRemark={setF1r} />
            <TimelineBlock title="Follow-up 2" date={f2d} setDate={setF2d} remark={f2r} setRemark={setF2r} />
            <TimelineBlock title="Follow-up 3" date={f3d} setDate={setF3d} remark={f3r} setRemark={setF3r} />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button style={btnPrimary} disabled={saving} onClick={save}>{saving ? "Saving..." : "Save"}</button>
          <button style={btnOutline} disabled={saving} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function TimelineBlock({
  title, date, setDate, remark, setRemark,
}: any) {
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, alignItems: "center" }}>
        <div>
          <div style={label}>Date</div>
          <input style={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <div style={label}>Remark</div>
          <input style={input} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Remark..." />
        </div>
      </div>
    </div>
  );
}

/* styles */
const overlay: any = { position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", justifyContent:"center", alignItems:"center", padding:12, zIndex:9999 };
const modal: any = { background:"#fff", borderRadius:12, width:720, maxWidth:"100%", padding:14, border:"1px solid #eee" };
const card: any = { border:"1px solid #eee", borderRadius:12, padding:12, background:"#fafafa" };
const input: any = { border:"1px solid #ddd", borderRadius:10, padding:"8px 10px", width:"100%", outline:"none" };
const label: any = { fontSize:12, color:"#555", marginBottom:6 };
const btnOutline: any = { border:"1px solid #ccc", background:"#fff", padding:"8px 12px", borderRadius:10, cursor:"pointer" };
const btnPrimary: any = { border:"1px solid #dc2626", background:"#dc2626", color:"#fff", padding:"8px 12px", borderRadius:10, cursor:"pointer", fontWeight:700 };
