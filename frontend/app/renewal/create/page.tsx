"use client";

import React, { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";

type SearchRow = {
  contact_id: number;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  address?: string | null;
  state?: string | null;
  district?: string | null;
  tehsil?: string | null;
  primary_phone?: string | null;
  vehicle_id?: number | null;
  chassis_number?: string | null;
  engine_number?: string | null;
  rto_number?: string | null;
  model_id?: number | null;
  variant_id?: number | null;
  model_name?: string | null;
  variant_name?: string | null;
};

type DDItem = { id: number; value: string; label?: string | null };

export default function AddPolicyPage() {
  const { permissions, loading: permLoading } = usePermissions();
  const canAdd = !!permissions.add_insurance;

  const [loadingDD, setLoadingDD] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [ddCompanies, setDdCompanies] = useState<DDItem[]>([]);
  const [ddCpa, setDdCpa] = useState<DDItem[]>([]);
  const [ddPolicyStatus, setDdPolicyStatus] = useState<DDItem[]>([]);

  const [contactSearch, setContactSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchRows, setSearchRows] = useState<SearchRow[]>([]);

  const [selected, setSelected] = useState<SearchRow | null>(null);

  const [company, setCompany] = useState("");
  const [policyNo, setPolicyNo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [premium, setPremium] = useState("");
  const [surveyCharge, setSurveyCharge] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [cpaIncluded, setCpaIncluded] = useState("NO");
  const [policyStatus, setPolicyStatus] = useState("running");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const isExpired = policyStatus === "expired";

  useEffect(() => {
    if (permLoading || !canAdd) return;

    async function loadDropdowns() {
      try {
        setLoadingDD(true);
        const res = await api.get("/api/insurance-policies/form-meta");
        const dd = res.data?.data || {};
        setDdCompanies(dd.insurance_company || []);
        setDdCpa(dd.cpa_included || []);
        setDdPolicyStatus(dd.policy_status || []);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load dropdowns");
      } finally {
        setLoadingDD(false);
      }
    }

    loadDropdowns();
  }, [permLoading, canAdd]);

  useEffect(() => {
    if (!contactSearch.trim()) {
      setSearchRows([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await api.get("/api/contacts/search", {
          params: { q: contactSearch.trim() },
        });
        setSearchRows(res.data?.data || []);
      } catch {
        setSearchRows([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [contactSearch]);

  const grouped = useMemo(() => {
    return searchRows.filter((r) => r.vehicle_id);
  }, [searchRows]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selected?.contact_id) return alert("Select contact");
    if (!selected?.vehicle_id) return alert("Select vehicle");
    if (!selected?.rto_number?.trim()) {
      return alert("Selected vehicle must have RTO number");
    }
    if (!startDate) return alert("Start date required");
    if (isExpired && !uploadedFile) {
      return alert("Uploaded file required for expired policy");
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("contact_id", String(selected.contact_id));
      fd.append("contact_vehicle_id", String(selected.vehicle_id));
      fd.append("vehicle_no", String(selected.rto_number || "").trim());
      fd.append("company", company || "");
      fd.append("policy_no", policyNo || "");
      fd.append("start_date", startDate);
      fd.append("premium", premium || "");
      fd.append("survey_charge", surveyCharge || "");
      fd.append("invoice_number", invoiceNumber || "");
      fd.append("notes", notes || "");
      fd.append("cpa_included", cpaIncluded === "YES" ? "1" : "0");
      fd.append("policy_status", policyStatus);
      if (uploadedFile) fd.append("uploaded_file", uploadedFile);

      await api.post("/api/insurance-policies", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Policy saved successfully");
      window.location.href = "/insurance";
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGuard roles={["owner", "admin", "manager", "insurance", "sales", "renewal"]}>
      <div style={pageWrap}>
        {permLoading ? (
          <div style={card}>Loading...</div>
        ) : !canAdd ? (
          <div style={card}>Permission denied</div>
        ) : (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Add Policy</h1>
                <div style={subTitle}>Contact + Vehicle linked insurance entry</div>
              </div>

              <button
                type="button"
                style={btnOutline}
                onClick={() => {
                  const ret = encodeURIComponent("/renewal/create");
                  window.location.href = `/contacts/new?returnTo=${ret}`;
                }}
              >
                + New Contact
              </button>
            </div>

            {error ? <div style={errorBox}>{error}</div> : null}

            <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
              <div style={sectionTitle}>1. Select Contact + Vehicle</div>

              <div style={grid}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={label}>Search Contact / Mobile / Chassis / Engine / RTO</div>
                  <input
                    style={input}
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Type customer name, mobile, chassis, engine, RTO..."
                  />
                  {searchLoading ? <div style={subText}>Searching...</div> : null}
                </div>

                {!!grouped.length && (
                  <div style={{ gridColumn: "1 / -1", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                      {grouped.map((r, idx) => {
                        const name =
                          r.full_name ||
                          [r.first_name, r.last_name].filter(Boolean).join(" ").trim() ||
                          `Contact #${r.contact_id}`;

                        const selectedKey = `${selected?.contact_id}-${selected?.vehicle_id}`;
                        const rowKey = `${r.contact_id}-${r.vehicle_id}`;
                        const isSelected = selectedKey === rowKey;

                        return (
                          <button
                            key={`${rowKey}-${idx}`}
                            type="button"
                            onClick={() => setSelected(r)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: 12,
                              border: "none",
                              borderBottom: "1px solid #f1f5f9",
                              background: isSelected ? "#eff6ff" : "#fff",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontWeight: 800 }}>{name}</div>
                            <div style={subText}>
                              Mobile: {r.primary_phone || "-"} | Model: {r.model_name || "-"} {r.variant_name || ""}
                            </div>
                            <div style={subText}>
                              RTO: {r.rto_number || "-"} | Chassis: {r.chassis_number || "-"} | Engine: {r.engine_number || "-"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selected && (
                  <div style={infoCard}>
                    <div><b>Customer:</b> {selected.full_name || [selected.first_name, selected.last_name].filter(Boolean).join(" ").trim() || "-"}</div>
                    <div><b>Phone:</b> {selected.primary_phone || "-"}</div>
                    <div><b>RTO Number:</b> {selected.rto_number || "-"}</div>
                    <div><b>Address:</b> {[selected.tehsil, selected.district, selected.state].filter(Boolean).join(", ") || selected.address || "-"}</div>
                    <div><b>Model:</b> {[selected.model_name, selected.variant_name].filter(Boolean).join(" ") || "-"}</div>
                    <div><b>Chassis:</b> {selected.chassis_number || "-"}</div>
                    <div><b>Engine:</b> {selected.engine_number || "-"}</div>
                  </div>
                )}
              </div>

              <div style={{ ...sectionTitle, marginTop: 20 }}>2. Policy Details</div>

              <div style={grid}>
                <div>
                  <div style={label}>Auto Vehicle Number</div>
                  <input
                    style={{ ...input, background: "#f3f4f6" }}
                    value={selected?.rto_number || ""}
                    readOnly
                    placeholder="Auto from selected contact vehicle"
                  />
                </div>

                <div>
                  <div style={label}>Insurance Company</div>
                  <select style={input} value={company} onChange={(e) => setCompany(e.target.value)} disabled={loadingDD}>
                    <option value="">-- Select Company --</option>
                    {ddCompanies.map((x) => (
                      <option key={x.id} value={x.value}>{x.label || x.value}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={label}>Policy Number</div>
                  <input style={input} value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} />
                </div>

                <div>
                  <div style={label}>Policy Start Date *</div>
                  <input style={input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>

                <div>
                  <div style={label}>CPA Included</div>
                  <select style={input} value={cpaIncluded} onChange={(e) => setCpaIncluded(e.target.value)} disabled={loadingDD}>
                    <option value="">-- Select CPA --</option>
                    {ddCpa.map((x) => (
                      <option key={x.id} value={x.value}>{x.label || x.value}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={label}>Policy Status</div>
                  <select style={input} value={policyStatus} onChange={(e) => setPolicyStatus(e.target.value)} disabled={loadingDD}>
                    <option value="">-- Select Status --</option>
                    {ddPolicyStatus.map((x) => (
                      <option key={x.id} value={x.value}>{x.label || x.value}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={label}>Premium Amount</div>
                  <input style={input} type="number" min="0" step="0.01" value={premium} onChange={(e) => setPremium(e.target.value)} />
                </div>

                <div>
                  <div style={label}>Survey Charge</div>
                  <input style={input} type="number" min="0" step="0.01" value={surveyCharge} onChange={(e) => setSurveyCharge(e.target.value)} />
                </div>

                <div>
                  <div style={label}>Invoice Number</div>
                  <input style={input} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={label}>Notes</div>
                  <textarea style={textarea} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={label}>{isExpired ? "Uploaded File *" : "Uploaded File"}</div>
                  <input
                    style={fileInput}
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <div style={actions}>
                <button type="button" style={btnOutline} onClick={() => (window.location.href = "/insurance")}>
                  Cancel
                </button>
                <button type="submit" style={btnPrimary} disabled={saving}>
                  {saving ? "Saving..." : "Save Policy"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

const pageWrap: any = { padding: 16, maxWidth: 1100, margin: "0 auto" };
const card: any = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" };
const subTitle: any = { marginTop: 6, color: "#6b7280", fontSize: 13 };
const sectionTitle: any = { fontSize: 15, fontWeight: 800, marginBottom: 10, color: "#111827" };
const grid: any = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 };
const label: any = { fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#374151" };
const input: any = { width: "100%", height: 42, border: "1px solid #d1d5db", borderRadius: 10, padding: "0 12px", fontSize: 14, outline: "none", background: "#fff" };
const fileInput: any = { width: "100%", border: "1px solid #d1d5db", borderRadius: 10, padding: 10, fontSize: 14, background: "#fff" };
const textarea: any = { width: "100%", minHeight: 100, border: "1px solid #d1d5db", borderRadius: 10, padding: 12, fontSize: 14, outline: "none", background: "#fff", resize: "vertical" };
const infoCard: any = { gridColumn: "1 / -1", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fafafa", display: "grid", gap: 6, fontSize: 14 };
const actions: any = { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18, flexWrap: "wrap" };
const btnOutline: any = { height: 40, padding: "0 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const btnPrimary: any = { height: 40, padding: "0 14px", borderRadius: 10, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const errorBox: any = { marginTop: 12, padding: 10, borderRadius: 10, background: "#fee2e2", color: "#991b1b", fontWeight: 600, fontSize: 13 };
const subText: any = { marginTop: 4, color: "#6b7280", fontSize: 12 };