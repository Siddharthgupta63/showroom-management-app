"use client";

import React, { useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";

type Filters = {
  source: "all" | "SALE" | "RENEWAL";
  search: string;
  from: string;
  to: string;
  status: "all" | "active" | "expiring" | "expired";
};

type Props = {
  role: string | null | undefined;
  canImport: boolean;
  canExport: boolean;
  filters: Filters;
  onImported?: () => void;
};

type PreviewRow = {
  rowIndex: number;
  policy_no: string;
  customer_name: string;
  vehicle_no: string;
  model_name?: string;
  company?: string;
  phone: string;
  start_date: string;
  expiry_date?: string;
  premium?: string;
  ok: boolean;
  error?: string;
};

const downloadTextFile = (filename: string, content: string, mime = "text/plain") => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const normalizePhone = (v: any) => String(v ?? "").replace(/\D/g, "").slice(0, 10);

const isYYYYMMDD = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

const parseCSV = (csvText: string) => {
  // simple CSV parser (supports quoted values)
  const lines = csvText.replace(/\r/g, "").split("\n").filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] as Record<string, string>[] };

  const splitLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out.map((v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v));
  };

  const headers = splitLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => (obj[h] = (cells[idx] ?? "").trim()));
    return obj;
  });

  return { headers, rows };
};

export default function OwnerImportExportButtons({
  role,
  canImport,
  canExport,
  filters,
  onImported,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  // preview modal state
  const [showPreview, setShowPreview] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState<{ total: number; ok: number; bad: number }>({
    total: 0,
    ok: 0,
    bad: 0,
  });
  const [previewErr, setPreviewErr] = useState<string>("");

  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isOwnerOrAllowedImport = role === "owner" || canImport;
  const isOwnerOrAllowedExport = role === "owner" || canExport;

  const sampleCSV = useMemo(() => {
    return [
      "policy_no,customer_name,vehicle_no,model_name,company,phone,start_date,expiry_date,premium",
      "TEST-001,Raj Kumar,MP20AB1234,Splendor,HDFC ERGO,9876543210,2026-01-01,2026-12-31,1500",
      "TEST-002,Sita Devi,MP20AB9999,Passion,ICICI Lombard,9999999999,2026-02-10,,1800",
    ].join("\n");
  }, []);

  const validateRow = (r: Record<string, string>, rowIndex: number): PreviewRow => {
    const policy_no = (r.policy_no || "").trim();
    const customer_name = (r.customer_name || "").trim();
    const vehicle_no = (r.vehicle_no || "").trim();
    const model_name = (r.model_name || "").trim();
    const company = (r.company || "").trim();
    const phone = normalizePhone(r.phone);
    const start_date = (r.start_date || "").trim();
    const expiry_date = (r.expiry_date || "").trim();
    const premium = (r.premium || "").trim();

    let error = "";
    if (!customer_name) error = "customer_name required";
    else if (!vehicle_no) error = "vehicle_no required";
    else if (!phone || phone.length !== 10) error = "phone must be 10 digits";
    else if (!start_date || !isYYYYMMDD(start_date)) error = "start_date must be YYYY-MM-DD";
    else if (expiry_date && !isYYYYMMDD(expiry_date)) error = "expiry_date must be YYYY-MM-DD (or blank)";

    return {
      rowIndex,
      policy_no,
      customer_name,
      vehicle_no,
      model_name,
      company,
      phone,
      start_date,
      expiry_date,
      premium,
      ok: !error,
      error: error || undefined,
    };
  };

  const openFilePicker = () => fileRef.current?.click();

  const onPickFile = async (file: File) => {
    setPreviewErr("");
    setPreviewRows([]);
    setPreviewSummary({ total: 0, ok: 0, bad: 0 });

    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv")) {
      setPreviewErr("Only CSV supported in preview mode. Please upload .csv");
      setShowPreview(true);
      return;
    }

    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    const required = ["customer_name", "vehicle_no", "phone", "start_date"];
    const missing = required.filter((h) => !headers.includes(h));
    if (missing.length) {
      setPreviewErr(`Missing columns: ${missing.join(", ")}`);
      setShowPreview(true);
      return;
    }

    const validated = rows.map((r, idx) => validateRow(r, idx + 2)); // +2 = header row + 1-based
    const ok = validated.filter((x) => x.ok).length;
    const bad = validated.length - ok;

    setPreviewRows(validated);
    setPreviewSummary({ total: validated.length, ok, bad });
    setShowPreview(true);

    // keep file in memory (store on ref)
    (fileRef.current as any)._selectedFile = file;
  };

  const confirmImport = async () => {
    const file: File | undefined = (fileRef.current as any)?._selectedFile;
    if (!file) return;

    const okRows = previewRows.filter((r) => r.ok);
    if (!okRows.length) {
      alert("No valid rows to import.");
      return;
    }

    setImporting(true);
    try {
      // Send only valid rows as JSON bulk import
      const payload = okRows.map((r) => ({
        policy_no: r.policy_no || null,
        customer_name: r.customer_name,
        vehicle_no: r.vehicle_no,
        model_name: r.model_name || null,
        company: r.company || null,
        phone: r.phone,
        start_date: r.start_date,
        expiry_date: r.expiry_date || null,
        premium: r.premium ? Number(r.premium) : null,
      }));

      await api.post("/api/insurance-policies/bulk-import", { rows: payload });

      setShowPreview(false);
      setPreviewRows([]);
      (fileRef.current as any)._selectedFile = null;

      alert(`Imported ${payload.length} rows successfully.`);
      onImported?.();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const exportFiltered = async () => {
    setExporting(true);
    try {
      // Get large list from combined endpoint with filters
      const res = await api.get("/api/insurance-combined", {
        params: {
          page: 1,
          pageSize: 50000,
          source: filters.source,
          search: filters.search?.trim() || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        },
      });

      const data: any[] = res.data?.data || [];

      const rows = data.filter((r) => {
        const d = Number(r.days_left ?? 999999);
        if (filters.status === "expired") return d < 0;
        if (filters.status === "expiring") return d >= 0 && d <= 10;
        if (filters.status === "active") return d > 10;
        return true;
      });

      const header = [
        "source",
        "policy_no",
        "customer_name",
        "phone",
        "vehicle_no",
        "model_name",
        "company",
        "start_date",
        "expiry_date",
        "days_left",
      ];

      const csv = [
        header.join(","),
        ...rows.map((r) =>
          header
            .map((k) => {
              const v = r[k] ?? "";
              const s = String(v).replace(/"/g, '""');
              return `"${s}"`;
            })
            .join(",")
        ),
      ].join("\n");

      downloadTextFile("insurance_export_filtered.csv", csv, "text/csv");
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
        }}
      />

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {isOwnerOrAllowedImport && (
          <button
            style={btn}
            onClick={openFilePicker}
            disabled={importing}
            title="Import CSV (with preview + validation)"
          >
            {importing ? "Importing..." : "Import"}
          </button>
        )}

        {isOwnerOrAllowedImport && (
          <button
            style={btnOutline}
            onClick={() => downloadTextFile("insurance_import_template.csv", sampleCSV, "text/csv")}
          >
            Sample CSV
          </button>
        )}

        {isOwnerOrAllowedExport && (
          <button style={btnOutline} onClick={exportFiltered} disabled={exporting}>
            {exporting ? "Exporting..." : "Export"}
          </button>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Import Preview</h3>
              <button style={closeBtn} onClick={() => setShowPreview(false)}>
                X
              </button>
            </div>

            {previewErr ? (
              <div style={{ marginTop: 12, padding: 10, background: "#fee2e2", borderRadius: 10, color: "#991b1b" }}>
                {previewErr}
              </div>
            ) : (
              <>
                <div style={{ marginTop: 12, fontSize: 13, color: "#374151" }}>
                  Total: <b>{previewSummary.total}</b> | Valid: <b>{previewSummary.ok}</b> | Invalid:{" "}
                  <b>{previewSummary.bad}</b>
                </div>

                <div style={{ marginTop: 12, maxHeight: 380, overflow: "auto", border: "1px solid #eee", borderRadius: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        {["Row", "customer_name", "vehicle_no", "phone", "start_date", "expiry_date", "status"].map((h) => (
                          <th key={h} style={th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 200).map((r) => (
                        <tr key={r.rowIndex}>
                          <td style={td}>{r.rowIndex}</td>
                          <td style={td}>{r.customer_name}</td>
                          <td style={td}>{r.vehicle_no}</td>
                          <td style={td}>{r.phone}</td>
                          <td style={td}>{r.start_date}</td>
                          <td style={td}>{r.expiry_date || "-"}</td>
                          <td style={{ ...td, fontWeight: 800, color: r.ok ? "#166534" : "#991b1b" }}>
                            {r.ok ? "OK" : r.error}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                  <button style={btnOutline} onClick={() => setShowPreview(false)}>
                    Cancel
                  </button>
                  <button style={btn} onClick={confirmImport} disabled={importing || previewSummary.ok === 0}>
                    {importing ? "Importing..." : `Import ${previewSummary.ok} Valid Rows`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const btn: any = {
  height: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #dc2626",
  background: "#dc2626",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const btnOutline: any = {
  height: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const overlay: any = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
  zIndex: 50,
};

const modal: any = {
  width: "min(900px, 96vw)",
  background: "#fff",
  borderRadius: 14,
  border: "1px solid #eee",
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
};

const closeBtn: any = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const th: any = {
  textAlign: "left",
  padding: "10px 10px",
  fontSize: 12,
  color: "#374151",
  borderBottom: "1px solid #eee",
};

const td: any = {
  padding: "10px 10px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 13,
  verticalAlign: "top",
};
