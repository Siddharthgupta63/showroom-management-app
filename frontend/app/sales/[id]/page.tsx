"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";

type Sale = any;

type BranchRow = { id: number; branch_name: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      {children}
    </div>
  );
}
function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full px-3 py-2 border rounded-lg ${props.className || ""}`} />;
}
function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full px-3 py-2 border rounded-lg ${props.className || ""}`} />;
}

// ✅ Locked display input (read-only)
function LockedInput({ value }: { value: any }) {
  return (
    <input
      value={value ?? ""}
      readOnly
      disabled
      className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
    />
  );
}
function LockedArea({ value, rows = 2 }: { value: any; rows?: number }) {
  return (
    <textarea
      value={value ?? ""}
      readOnly
      disabled
      rows={rows}
      className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
    />
  );
}

function yyyyMmDd(v: any) {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getBackendOrigin() {
  const raw =
    (process.env.NEXT_PUBLIC_API_URL as string) ||
    (process.env.NEXT_PUBLIC_API_BASE_URL as string) ||
    "/api";
  return raw.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

function normalizeDocUrl(u: any, filename?: string) {
  const origin = getBackendOrigin();

  if (typeof u === "string" && /^https?:\/\//i.test(u)) return u;
  if (typeof u === "string" && u.startsWith("/")) return origin + u;
  if (filename) return `${origin}/uploads/sales/${filename}`;
  return "";
}

function bytesToHuman(n: number) {
  if (!Number.isFinite(n)) return "-";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

export default function SaleViewEditPage() {
  const params = useParams();
  const router = useRouter();
  const idRaw = (params as any)?.id;
  const id = Number(idRaw);

  const API_ORIGIN = getBackendOrigin();

  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState("");
  useEffect(() => {
    setMounted(true);
    setRole(String(getUser()?.role || "").toLowerCase());
  }, []);

  const canEdit = role === "owner" || role === "admin" || role === "manager";
  const canDelete = role === "owner" || role === "admin";
  const canCancel = role === "owner" || role === "admin" || role === "manager";

  // ✅ everyone can upload documents later (per your requirement)
  const canUploadDocs = true;

  const [loading, setLoading] = useState(true);
  const [sale, setSale] = useState<Sale | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [docsUploading, setDocsUploading] = useState(false);
  const [docsErr, setDocsErr] = useState("");

  const fileRef = useRef<HTMLInputElement | null>(null);

  // ✅ Branches
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const loadBranches = async () => {
    try {
      const res = await api.get("/api/branches");
      setBranches(res.data?.data || []);
    } catch {
      setBranches([]);
    }
  };

  const load = async () => {
    if (!Number.isFinite(id)) return;
    setLoading(true);
    setErr("");
    try {
      const res = await api.get(`/api/sales/${id}`);
      setSale(res.data?.data || null);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to load sale");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idRaw]);

  const isCancelled = Number(sale?.is_cancelled || 0) === 1;
  const updateField = (k: string, v: any) => setSale((s: any) => ({ ...(s || {}), [k]: v }));

  const branchName = useMemo(() => {
    const bid = sale?.branch_id ? Number(sale.branch_id) : null;
    if (!bid) return sale?.branch_name || "";
    return sale?.branch_name || branches.find((b) => Number(b.id) === bid)?.branch_name || "";
  }, [sale?.branch_id, sale?.branch_name, branches]);

  const docs = useMemo(() => {
    try {
      if (!sale?.documents_json) return [];
      if (Array.isArray(sale.documents_json)) return sale.documents_json;
      return JSON.parse(sale.documents_json);
    } catch {
      return [];
    }
  }, [sale?.documents_json]);

  // ✅ FIX: Print must include token (new tab doesn't send Authorization header)
  const openPrint = () => {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("jwt") ||
      "";

    if (!token) {
      alert("Login token not found. Please logout and login again.");
      return;
    }

    const url = `${API_ORIGIN}/api/sales/${id}/print?token=${encodeURIComponent(token)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const save = async () => {
    if (!sale) return;
    setMsg("");
    setErr("");
    setSaving(true);

    try {
      const payload = {
        // ✅ keep required fields always
        customer_name: (sale.customer_name || "").trim(),
        mobile_number: (sale.mobile_number || "").trim() || null,
        email: sale.email || null,

        // ✅ branch support
        branch_id: sale.branch_id != null && String(sale.branch_id) !== "" ? Number(sale.branch_id) : null,

        sale_date: yyyyMmDd(sale.sale_date),

        sale_price: sale.sale_price,
        invoice_number: sale.invoice_number,

        address: sale.address || null,

        father_name: sale.father_name || null,
        age: sale.age != null && String(sale.age) !== "" ? Number(sale.age) : null,

        nominee_name: sale.nominee_name || null,
        nominee_relation: sale.nominee_relation || null,

        tyre: sale.tyre || null,
        battery_no: sale.battery_no || null,
        key_no: sale.key_no || null,

        insurance_number: sale.insurance_number || null,
        insurance_company: sale.insurance_company || null,
        insurance_broker: sale.insurance_broker || null,

        cpa_insurance_number: sale.cpa_insurance_number || null,
        cpa_applicable: Number(sale.cpa_applicable) === 1 ? 1 : 0,
        cpa_number: sale.cpa_number || null,

        finance_company: sale.finance_company || null,

        rc_required: Number(sale.rc_required) === 1 ? 1 : 0,
        aadhaar_required: Number(sale.aadhaar_required) === 1 ? 1 : 0,
        aadhaar_number: sale.aadhaar_number || null,

        sb_tools: sale.sb_tools || null,
        good_life_no: sale.good_life_no || null,
        helmet: sale.helmet || null,
        notes: sale.notes || null,
      };

      await api.put(`/api/sales/${id}`, payload);
      setMsg("Saved ✅");
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const cancelSale = async () => {
    if (!confirm("Cancel this sale?")) return;
    setErr("");
    setMsg("");
    try {
      await api.post(`/api/sales/${id}/cancel`);
      setMsg("Cancelled ✅");
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to cancel");
    }
  };

  const deleteSale = async () => {
    if (!confirm("Delete this sale permanently?")) return;
    setErr("");
    setMsg("");
    try {
      await api.delete(`/api/sales/${id}`);
      router.push("/sales");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to delete");
    }
  };

  const uploadDocs = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!Number.isFinite(id)) return;
    setDocsErr("");
    setMsg("");
    setDocsUploading(true);

    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));

      await api.post(`/api/sales/${id}/documents`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMsg("Documents uploaded ✅");
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e: any) {
      setDocsErr(e?.response?.data?.message || "Upload failed");
    } finally {
      setDocsUploading(false);
    }
  };

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Sale #{Number.isFinite(id) ? id : String(idRaw)}</h1>
              <p className="text-sm text-gray-500">
                {isCancelled ? "Cancelled" : "Active"} • Role: {mounted ? role || "-" : "-"}
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Link href="/sales" className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50">
                ← Back
              </Link>

              <button
                onClick={openPrint}
                disabled={!Number.isFinite(id)}
                className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Print / PDF
              </button>

              {canEdit && (
                <button
                  onClick={save}
                  disabled={saving || loading || !sale}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              )}

              {canCancel && !isCancelled && (
                <button onClick={cancelSale} className="px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700">
                  Cancel
                </button>
              )}

              {canDelete && (
                <button onClick={deleteSale} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700">
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Documents */}
          <div className="mt-4 border rounded-xl bg-white p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold">Documents</div>
              <div className="text-xs text-gray-500">
                Upload sale documents (PDF/JPG/PNG). Stored in <code>sales.documents_json</code>
              </div>

              {docsErr && <div className="text-sm text-red-600 mt-2">{docsErr}</div>}
              {msg && <div className="text-sm text-green-700 mt-2">{msg}</div>}
              {err && <div className="text-sm text-red-600 mt-2">{err}</div>}
            </div>

            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => uploadDocs(e.target.files)} />
              <button
                onClick={() => fileRef.current?.click()}
                // ✅ allow everyone to upload (not blocked by canEdit)
                disabled={!canUploadDocs || docsUploading || !Number.isFinite(id)}
                className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {docsUploading ? "Uploading..." : "Upload Documents"}
              </button>
            </div>
          </div>

          {/* Uploaded Files */}
          <div className="mt-3 border rounded-xl bg-white p-4">
            <div className="font-semibold">Uploaded Files</div>
            {docs.length === 0 ? (
              <div className="text-sm text-gray-500 mt-2">No documents uploaded.</div>
            ) : (
              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">Name</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Uploaded</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d: any, idx: number) => {
                      const name = d.originalname || d.filename || d.fileName || `Document ${idx + 1}`;
                      const url = normalizeDocUrl(d.url || d.path, d.filename || d.fileName);

                      return (
                        <tr key={`${name}-${idx}`} className="border-b">
                          <td className="py-2">{name}</td>
                          <td>{d.mimetype || "-"}</td>
                          <td>{d.size ? bytesToHuman(Number(d.size)) : "-"}</td>
                          <td>
                            {d.uploaded_at ? String(d.uploaded_at).slice(0, 10) : d.uploadedAt ? String(d.uploadedAt).slice(0, 10) : "-"}
                          </td>
                          <td className="text-right">
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 inline-block"
                              >
                                View
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Form */}
          {loading ? (
            <div className="mt-4 text-gray-500">Loading...</div>
          ) : !sale ? (
            <div className="mt-4 text-red-600">Sale not found</div>
          ) : (
            <div className="mt-4 border rounded-xl bg-white p-4">
              <div className="text-xs text-gray-500 mb-3">
                Customer + Vehicle fields are locked. To change them, update Contacts/Vehicles only.
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {/* ✅ Branch */}
                <Field label="Branch">
                  {canEdit ? (
                    <select
                      value={sale.branch_id ?? ""}
                      onChange={(e) => updateField("branch_id", e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option value="">Select Branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.branch_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-3 py-2 border rounded-lg bg-gray-50">{branchName || "-"}</div>
                  )}
                </Field>

                {/* ✅ LOCKED: picked from contact */}
                <Field label="Customer Name (Locked)">
                  <LockedInput value={sale.customer_name || ""} />
                </Field>

                <Field label="Mobile (Locked)">
                  <LockedInput value={sale.mobile_number || ""} />
                </Field>

                <Field label="Email (Locked)">
                  <LockedInput value={sale.email || ""} />
                </Field>

                <Field label="Address (Locked)">
                  <LockedArea value={sale.address || ""} rows={2} />
                </Field>

                {/* ✅ LOCKED: picked from vehicle */}
                <Field label="Vehicle Model (Locked)">
                  <LockedInput value={sale.vehicle_model || ""} />
                </Field>

                <Field label="Chassis (Locked)">
                  <LockedInput value={sale.chassis_number || ""} />
                </Field>

                <Field label="Engine (Locked)">
                  <LockedInput value={sale.engine_number || ""} />
                </Field>

                {/* ✅ Editable sale fields */}
                <Field label="Sale Date">
                  <TextInput
                    type="date"
                    value={yyyyMmDd(sale.sale_date)}
                    onChange={(e) => updateField("sale_date", e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>

                <Field label="Sale Price">
                  <TextInput
                    type="number"
                    value={String(sale.sale_price ?? 0)}
                    onChange={(e) => updateField("sale_price", e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>

                <Field label="Invoice Number">
                  <TextInput
                    value={sale.invoice_number || ""}
                    onChange={(e) => updateField("invoice_number", e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>

                <Field label="Finance Company">
                  <TextInput
                    value={sale.finance_company || ""}
                    onChange={(e) => updateField("finance_company", e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>

                <Field label="Father Name">
                  <TextInput
                    value={sale.father_name || ""}
                    onChange={(e) => updateField("father_name", e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>

                <Field label="Age">
                  <TextInput
                    value={sale.age ?? ""}
                    onChange={(e) => updateField("age", e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>

                <Field label="Insurance Company">
                  <TextInput
                    value={sale.insurance_company || ""}
                    onChange={(e) => updateField("insurance_company", e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>

                <Field label="Policy Number">
                  <TextInput
                    value={sale.insurance_number || ""}
                    onChange={(e) => updateField("insurance_number", e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>

                <Field label="Insurance Broker">
                  <TextInput
                    value={sale.insurance_broker || ""}
                    onChange={(e) => updateField("insurance_broker", e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>

                <Field label="CPA Applicable (0/1)">
                  <TextInput
                    type="number"
                    value={String(sale.cpa_applicable ?? 0)}
                    onChange={(e) => updateField("cpa_applicable", e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>

                <Field label="CPA Insurance Number">
                  <TextInput
                    value={sale.cpa_insurance_number || ""}
                    onChange={(e) => updateField("cpa_insurance_number", e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>

                <Field label="Helmet">
                  <TextInput
                    value={sale.helmet || ""}
                    onChange={(e) => updateField("helmet", e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>

                <Field label="Notes">
                  <TextArea
                    rows={2}
                    value={sale.notes || ""}
                    onChange={(e) => updateField("notes", e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
