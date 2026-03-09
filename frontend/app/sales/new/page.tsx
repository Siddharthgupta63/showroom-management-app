"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";

type ContactRow = {
  id: number;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  primary_phone?: string | null;
};

type ContactDetails = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  address: string | null;
  phones: Array<{ id: number; phone: string; is_primary: number; is_active: number }>;
};

type VehicleRow = {
  id: number;
  contact_id: number | null;
  chassis_number: string;
  engine_number: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  color: string | null;
  model_name: string | null;
  variant_name: string | null;

  is_sold?: number | null;
  sold_sale_id?: number | null;
};

type SalesTraceRow = {
  id: number;
  customer_name: string;
  mobile_number: string | null;
  chassis_number: string | null;
  engine_number: string | null;
  sale_date: string;
  invoice_number: string | null;
  is_cancelled: number;
};

type DropdownItem = { id: number; value: string };
type BranchRow = { id: number; branch_name: string };

function toYYYYMMDD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-200 " +
        (props.className || "")
      }
    />
  );
}
function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        "w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-200 " +
        (props.className || "")
      }
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      {children}
    </div>
  );
}

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

export default function NewSalePage() {
  const router = useRouter();
  const user = getUser();
  const role = String(user?.role || "").toLowerCase();
  const isOwnerAdmin = role === "owner" || role === "admin";

  const [err, setErr] = useState("");

  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");

  const loadBranches = async () => {
    try {
      const res = await api.get("/api/branches");
      setBranches(res.data?.data || []);
    } catch {
      setBranches([]);
    }
  };

  const [ddInsuranceCompanies, setDdInsuranceCompanies] = useState<DropdownItem[]>([]);
  const [ddInsuranceBrokers, setDdInsuranceBrokers] = useState<DropdownItem[]>([]);
  const [ddFinanceCompanies, setDdFinanceCompanies] = useState<DropdownItem[]>([]);
  const [ddTyres, setDdTyres] = useState<DropdownItem[]>([]);
  const [ddHelmets, setDdHelmets] = useState<DropdownItem[]>([]);
  const [ddNomineeRelations, setDdNomineeRelations] = useState<DropdownItem[]>([]);

  const loadDropdowns = async () => {
  try {
    const res = await api.get("/api/dropdowns", {
      params: {
        types: "insurance_company,insurance_broker,finance_company,tyre,helmet,nominee_relation",
      },
    });

    const data = res.data?.data || {};
    setDdInsuranceCompanies(data.insurance_company || []);
    setDdInsuranceBrokers(data.insurance_broker || []);
    setDdFinanceCompanies(data.finance_company || []);
    setDdTyres(data.tyre || []);
    setDdHelmets(data.helmet || []);
    setDdNomineeRelations(data.nominee_relation || []);
  } catch {
    setDdInsuranceCompanies([]);
    setDdInsuranceBrokers([]);
    setDdFinanceCompanies([]);
    setDdTyres([]);
    setDdHelmets([]);
    setDdNomineeRelations([]);
  }
};

  useEffect(() => {
    loadBranches();
    loadDropdowns();
  }, []);

  const addDropdownValue = async (type: string) => {
    const v = window.prompt(`Add ${type.replaceAll("_", " ")}`);
    if (!v) return;
    await api.post(`/api/dropdowns/${type}`, { value: v });
    await loadDropdowns();
  };

  const DropdownOrInput = ({
    value,
    onChange,
    options,
    placeholder,
    typeKey,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: DropdownItem[];
    placeholder: string;
    typeKey?: string;
  }) => {
    if (!options || options.length === 0) {
      return (
        <TextInput value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      );
    }
    return (
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-white"
        >
          <option value="">Select</option>
          {options.map((x) => (
            <option key={x.id} value={x.value}>
              {x.value}
            </option>
          ))}
        </select>
        {isOwnerAdmin && typeKey ? (
          <button
            type="button"
            className="px-3 py-2 border rounded-lg bg-white hover:bg-gray-50"
            title="Add to dropdown"
            onClick={() => addDropdownValue(typeKey)}
          >
            +
          </button>
        ) : null}
      </div>
    );
  };

  const [cq, setCq] = useState("");
  const dcq = useDebounced(cq, 250);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactPage, setContactPage] = useState(1);
  const [contactPageSize, setContactPageSize] = useState(20);
  const [contactTotal, setContactTotal] = useState<number | null>(null);

  const [contactId, setContactId] = useState<number | null>(null);
  const [contact, setContact] = useState<ContactDetails | null>(null);
  const [contactPicked, setContactPicked] = useState(false);

  const fetchContacts = async (q: string, page: number, pageSize: number) => {
    setContactLoading(true);
    try {
      const res = await api.get("/api/contacts", { params: { q, page, pageSize } });
      setContacts(res.data?.data || []);
      setContactTotal(typeof res.data?.total === "number" ? res.data.total : null);
    } finally {
      setContactLoading(false);
    }
  };

  useEffect(() => {
    setContactPage(1);
  }, [dcq]);

  useEffect(() => {
    fetchContacts(dcq.trim(), contactPage, contactPageSize).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dcq, contactPage, contactPageSize]);

  const loadContact = async (id: number) => {
    const res = await api.get(`/api/contacts/${id}`);
    const data = res.data?.data || {};
    const c = data.contact || data;
    const phones = data.phones || c.phones || [];
    setContact({ ...c, phones });
  };

  const primaryPhone = useMemo(() => {
    if (!contact?.phones?.length) return "";
    const active = contact.phones.filter((p) => Number(p.is_active) === 1);
    return active.find((p) => Number(p.is_primary) === 1)?.phone || active[0]?.phone || "";
  }, [contact]);

  const contactFullName = useMemo(() => {
    if (!contact) return "";
    return (
      contact.full_name ||
      [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() ||
      `Contact #${contact.id}`
    );
  }, [contact]);

  const [vq, setVq] = useState("");
  const dvq = useDebounced(vq, 250);
  const [includeUnlinked, setIncludeUnlinked] = useState(true);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [vehiclePage, setVehiclePage] = useState(1);
  const [vehiclePageSize, setVehiclePageSize] = useState(20);
  const [vehicleTotal, setVehicleTotal] = useState<number | null>(null);

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleRow | null>(null);
  const [vehiclePicked, setVehiclePicked] = useState(false);

  const fetchVehicles = async (q: string, page: number, pageSize: number) => {
    if (!contactId) return;

    setVehicleLoading(true);
    try {
      const params: any = { q, page, pageSize };
      if (!includeUnlinked || !q.trim()) params.contact_id = contactId;
      const res = await api.get("/api/vehicles", { params });
      setVehicles(res.data?.data || []);
      setVehicleTotal(typeof res.data?.total === "number" ? res.data.total : null);
    } finally {
      setVehicleLoading(false);
    }
  };

  useEffect(() => {
    setVehiclePage(1);
  }, [dvq, includeUnlinked, contactId]);

  useEffect(() => {
    if (!contactId) return;
    fetchVehicles(dvq.trim(), vehiclePage, vehiclePageSize).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dvq, vehiclePage, vehiclePageSize, includeUnlinked, contactId]);

  const [history, setHistory] = useState<SalesTraceRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const pickVehicle = async (v: VehicleRow) => {
    setErr("");

    const sold = Number(v.is_sold || 0) === 1;
    if (sold) {
      setErr(`This vehicle is already SOLD${v.sold_sale_id ? ` (#${v.sold_sale_id})` : ""}.`);
      return;
    }

    setSelectedVehicle(v);
    setVehiclePicked(true);

    setHistory([]);
    setHistoryLoading(true);
    try {
      const res = await api.get("/api/sales/trace", {
        params: { chassis: v.chassis_number, engine: v.engine_number, page: 1, pageSize: 10 },
      });
      setHistory(res.data?.data || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const [saleDate, setSaleDate] = useState(toYYYYMMDD(new Date()));
  const [customerName, setCustomerName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [fatherName, setFatherName] = useState("");
  const [age, setAge] = useState<string>("");

  const [nomineeName, setNomineeName] = useState("");
  const [nomineeRelation, setNomineeRelation] = useState("");

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [salePrice, setSalePrice] = useState<number>(0);

  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [insuranceCompany, setInsuranceCompany] = useState("");
  const [insuranceBroker, setInsuranceBroker] = useState("");

  const [paymentType, setPaymentType] = useState<"cash" | "finance">("cash");
  const [financeCompany, setFinanceCompany] = useState("");

  const [cpaIncluded, setCpaIncluded] = useState<"included" | "not_included">("included");
  const [cpaInsuranceNumber, setCpaInsuranceNumber] = useState("");

  const [tyre, setTyre] = useState("");
  const [batteryNo, setBatteryNo] = useState("");
  const [keyNo, setKeyNo] = useState("");
  const [helmet, setHelmet] = useState("");

  const [rcRequired, setRcRequired] = useState(false);
  const [aadhaarRequired, setAadhaarRequired] = useState(false);
  const [aadhaarNumber, setAadhaarNumber] = useState("");

  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (cpaIncluded === "included") setCpaInsuranceNumber("");
  }, [cpaIncluded]);

  useEffect(() => {
    if (!contactPicked || !contactId || !contact) return;
    setCustomerName(contactFullName);
    setMobileNumber(primaryPhone);
    setAddress(contact.address || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactPicked, contactId, contact?.id]);

  const pickedModel = selectedVehicle?.model_name || selectedVehicle?.vehicle_model || "";
  const pickedVariant = selectedVehicle?.variant_name || "";
  const vehicleLabel = [pickedModel, pickedVariant].filter(Boolean).join(" ").trim();

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pendingDocs, setPendingDocs] = useState<File[]>([]);
  const [docsUploading, setDocsUploading] = useState(false);

  const onPickDocs = (files: FileList | null) => {
    if (!files) return;
    setPendingDocs(Array.from(files));
  };

  const uploadDocsAfterCreate = async (saleId: number) => {
    if (!pendingDocs.length) return;
    setDocsUploading(true);
    try {
      const fd = new FormData();
      pendingDocs.forEach((f) => fd.append("files", f));
      await api.post(`/api/sales/${saleId}/documents`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPendingDocs([]);
    } finally {
      setDocsUploading(false);
    }
  };

  const clearContact = () => {
    setContactId(null);
    setContact(null);
    setContactPicked(false);

    setSelectedVehicle(null);
    setVehiclePicked(false);
    setHistory([]);

    setCustomerName("");
    setMobileNumber("");
    setEmail("");
    setAddress("");

    setVq("");
    setVehicles([]);
    setVehiclePage(1);
  };

  const clearVehicle = () => {
    setSelectedVehicle(null);
    setVehiclePicked(false);
    setHistory([]);
  };

  const canSave = !!contactId && !!selectedVehicle?.id && branchId !== "";

  const createSale = async () => {
    setErr("");

    if (branchId === "") {
      setErr("Branch is required.");
      return;
    }
    if (!contactId || !selectedVehicle?.id) {
      setErr("Select Contact + Vehicle first (hard rule).");
      return;
    }
    if (Number(selectedVehicle.is_sold || 0) === 1) {
      setErr(`This vehicle is already SOLD${selectedVehicle.sold_sale_id ? ` (#${selectedVehicle.sold_sale_id})` : ""}.`);
      return;
    }

    const missing: string[] = [];
    if (!customerName.trim()) missing.push("Customer Name");
    if (!mobileNumber.trim()) missing.push("Mobile");
    if (!fatherName.trim()) missing.push("Father Name");
    if (!invoiceNumber.trim()) missing.push("Invoice Number");

    if (!insuranceNumber.trim()) missing.push("Insurance Number");
    if (!insuranceCompany.trim()) missing.push("Insurance Company");
    if (!insuranceBroker.trim()) missing.push("Insurance Broker");

    if (paymentType === "finance" && !financeCompany.trim()) missing.push("Finance Company");
    if (cpaIncluded === "not_included" && !cpaInsuranceNumber.trim()) missing.push("CPA Insurance Number");

    if (missing.length) {
      setErr(`Please fill required: ${missing.join(", ")}`);
      return;
    }

    try {
      const payload: any = {
        branch_id: Number(branchId),

        contact_id: contactId,
        contact_vehicle_id: selectedVehicle.id,

        customer_name: customerName.trim(),
        mobile_number: mobileNumber.trim(),
        email: email || null,
        address: address || null,

        vehicle_make: selectedVehicle.vehicle_make || "Hero",
        vehicle_model: vehicleLabel || null,
        chassis_number: selectedVehicle.chassis_number,
        engine_number: selectedVehicle.engine_number,

        sale_date: saleDate,
        sale_price: salePrice,
        invoice_number: invoiceNumber || null,

        father_name: fatherName || null,
        age: age ? Number(age) : null,

        nominee_name: nomineeName || null,
        nominee_relation: nomineeRelation || null,

        insurance_number: insuranceNumber || null,
        insurance_company: insuranceCompany || null,
        insurance_broker: insuranceBroker || null,

        finance_company: paymentType === "finance" ? financeCompany || null : null,

        cpa_applicable: cpaIncluded === "included" ? 1 : 0,
        cpa_insurance_number: cpaIncluded === "not_included" ? cpaInsuranceNumber || null : null,

        tyre: tyre || null,
        battery_no: batteryNo || null,
        key_no: keyNo || null,
        helmet: helmet || null,

        rc_required: rcRequired ? 1 : 0,
        aadhaar_required: aadhaarRequired ? 1 : 0,
        aadhaar_number: aadhaarNumber || null,

        notes: notes || null,
      };

      const res = await api.post("/api/sales", payload);
      const newId = res.data?.data?.id;

      if (!newId) {
        router.push("/sales");
        return;
      }

      try {
        if (pendingDocs.length) await uploadDocsAfterCreate(newId);
      } catch (e: any) {
        window.alert(e?.response?.data?.message || "Sale created, but document upload failed.");
      }

      router.push(`/sales/${newId}`);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to create sale");
    }
  };

  const contactTotalPages = contactTotal ? Math.max(1, Math.ceil(contactTotal / contactPageSize)) : null;
  const vehicleTotalPages = vehicleTotal ? Math.max(1, Math.ceil(vehicleTotal / vehiclePageSize)) : null;

  const lockedVehicleMake = selectedVehicle?.vehicle_make || "Hero";
  const lockedVehicleModel = vehicleLabel || "";
  const lockedChassis = selectedVehicle?.chassis_number || "";
  const lockedEngine = selectedVehicle?.engine_number || "";

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">New Sale</h1>
              <p className="text-sm text-gray-500">Hard rule: Branch + Contact + Vehicle required.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/sales" className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50">
                ← Back
              </Link>
              <button
                onClick={createSale}
                disabled={!canSave || docsUploading}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {docsUploading ? "Uploading..." : "Save Sale"}
              </button>
            </div>
          </div>

          <div className="mt-4 border rounded-xl bg-white p-4">
            <div className="font-semibold">Branch *</div>
            <div className="text-xs text-gray-500 mb-2">Required for every sale</div>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3 py-2 border rounded-lg bg-white"
            >
              <option value="">Select Branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branch_name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 border rounded-xl bg-white p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold">Documents</div>
              <div className="text-xs text-gray-500">
                Choose documents now — they will upload automatically after you click <b>Save Sale</b>.
              </div>
              {pendingDocs.length > 0 && (
                <div className="text-xs text-gray-700 mt-1">
                  Selected: <b>{pendingDocs.length}</b> file(s)
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onPickDocs(e.target.files)} />
              <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">
                Choose Documents
              </button>
              {pendingDocs.length > 0 && (
                <button onClick={() => setPendingDocs([])} className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">
                  Clear
                </button>
              )}
            </div>
          </div>

          {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

          <div className="mt-6 border rounded-xl bg-white p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-semibold">1) Select Customer</div>
                <div className="text-xs text-gray-500">Search by name or mobile</div>
              </div>

              {contactPicked ? (
                <button onClick={clearContact} className="px-3 py-2 border rounded-lg bg-white hover:bg-gray-50" type="button">
                  Change Customer
                </button>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Page size</span>
                  <select
                    value={contactPageSize}
                    onChange={(e) => {
                      setContactPageSize(Number(e.target.value));
                      setContactPage(1);
                    }}
                    className="px-2 py-2 border rounded-lg"
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {contactPicked && contact ? (
              <div className="mt-3 p-3 rounded-lg border bg-blue-50 border-blue-200 text-sm">
                Selected: <b>{contactFullName}</b> • Mobile: <b>{primaryPhone || "-"}</b>
              </div>
            ) : (
              <>
                <div className="mt-3 flex gap-2 items-center flex-wrap">
                  <TextInput value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Search customer..." />
                </div>

                <div className="mt-3 overflow-auto border rounded-xl">
                  <table className="min-w-[800px] w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-3 text-left">ID</th>
                        <th className="p-3 text-left">Name</th>
                        <th className="p-3 text-left">Mobile</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contactLoading ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-gray-500">
                            Loading...
                          </td>
                        </tr>
                      ) : contacts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-gray-500">
                            No contacts found.
                          </td>
                        </tr>
                      ) : (
                        contacts.map((c) => (
                          <tr key={c.id} className="border-t hover:bg-gray-50">
                            <td className="p-3 text-gray-600">{c.id}</td>
                            <td className="p-3 font-medium">{c.full_name || "-"}</td>
                            <td className="p-3">{c.primary_phone || "-"}</td>
                            <td className="p-3 text-right">
                              <button
                                className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50"
                                type="button"
                                onClick={async () => {
                                  setContactId(c.id);
                                  await loadContact(c.id);
                                  setContactPicked(true);

                                  setSelectedVehicle(null);
                                  setVehiclePicked(false);
                                  setHistory([]);
                                }}
                              >
                                Select
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                  <div className="text-gray-600">
                    Page <b>{contactPage}</b>
                    {contactTotalPages ? (
                      <>
                        {" "}
                        of <b>{contactTotalPages}</b>
                      </>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-2 border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
                      disabled={contactPage <= 1}
                      type="button"
                      onClick={() => setContactPage((p) => Math.max(1, p - 1))}
                    >
                      Prev
                    </button>
                    <button
                      className="px-3 py-2 border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
                      disabled={contactTotalPages ? contactPage >= contactTotalPages : contacts.length < contactPageSize}
                      type="button"
                      onClick={() => setContactPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 border rounded-xl bg-white p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-semibold">2) Select Vehicle</div>
                <div className="text-xs text-gray-500">Search by engine/chassis/model</div>
              </div>

              {vehiclePicked ? (
                <button onClick={clearVehicle} className="px-3 py-2 border rounded-lg bg-white hover:bg-gray-50" type="button">
                  Change Vehicle
                </button>
              ) : (
                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={includeUnlinked} onChange={(e) => setIncludeUnlinked(e.target.checked)} />
                    Search all vehicles
                  </label>
                  <span className="text-gray-600">Page size</span>
                  <select
                    value={vehiclePageSize}
                    onChange={(e) => {
                      setVehiclePageSize(Number(e.target.value));
                      setVehiclePage(1);
                    }}
                    className="px-2 py-2 border rounded-lg"
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {!contactId ? (
              <div className="mt-2 text-sm text-amber-700">Select a customer first.</div>
            ) : vehiclePicked && selectedVehicle ? (
              <div className="mt-3 p-3 rounded-lg border bg-blue-50 border-blue-200 text-sm">
                Selected: <b>{vehicleLabel || "Vehicle"}</b> • Chassis:{" "}
                <b className="font-mono">{selectedVehicle.chassis_number}</b> • Engine:{" "}
                <b className="font-mono">{selectedVehicle.engine_number}</b>
              </div>
            ) : (
              <>
                <div className="mt-3">
                  <TextInput value={vq} onChange={(e) => setVq(e.target.value)} placeholder="Search vehicle..." />
                </div>

                <div className="mt-3 overflow-auto border rounded-xl">
                  <table className="min-w-[980px] w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-3 text-left">Model</th>
                        <th className="p-3 text-left">Variant</th>
                        <th className="p-3 text-left">Chassis</th>
                        <th className="p-3 text-left">Engine</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-right">Pick</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicleLoading ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-gray-500">
                            Loading...
                          </td>
                        </tr>
                      ) : vehicles.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-gray-500">
                            No vehicles found.
                          </td>
                        </tr>
                      ) : (
                        vehicles.map((v) => {
                          const sold = Number(v.is_sold || 0) === 1;
                          return (
                            <tr key={v.id} className="border-t hover:bg-gray-50">
                              <td className="p-3">{v.model_name || v.vehicle_model || "-"}</td>
                              <td className="p-3">{v.variant_name || "-"}</td>
                              <td className="p-3 font-mono">{v.chassis_number}</td>
                              <td className="p-3 font-mono">{v.engine_number}</td>
                              <td className="p-3">
                                {sold ? (
                                  <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                                    SOLD {v.sold_sale_id ? `(#${v.sold_sale_id})` : ""}
                                  </span>
                                ) : (
                                  <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                                    Available
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
                                  type="button"
                                  disabled={sold}
                                  onClick={() => pickVehicle(v)}
                                >
                                  Pick
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                  <div className="text-gray-600">
                    Page <b>{vehiclePage}</b>
                    {vehicleTotalPages ? (
                      <>
                        {" "}
                        of <b>{vehicleTotalPages}</b>
                      </>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-2 border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
                      disabled={vehiclePage <= 1}
                      type="button"
                      onClick={() => setVehiclePage((p) => Math.max(1, p - 1))}
                    >
                      Prev
                    </button>
                    <button
                      className="px-3 py-2 border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
                      disabled={vehicleTotalPages ? vehiclePage >= vehicleTotalPages : vehicles.length < vehiclePageSize}
                      type="button"
                      onClick={() => setVehiclePage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {contactId && selectedVehicle && (
            <div className="mt-6 border rounded-xl bg-white p-4">
              <div className="font-semibold">3) Sale Details</div>
              <div className="text-xs text-gray-500 mt-1">
                Customer + Vehicle fields are locked. To change them, use Contacts/Vehicles screens.
              </div>

              <div className="mt-3 grid md:grid-cols-3 gap-4">
                <Field label="Customer Name (Locked)">
                  <LockedInput value={customerName} />
                </Field>

                <Field label="Mobile (Locked)">
                  <LockedInput value={mobileNumber} />
                </Field>

                <Field label="Email (Locked)">
                  <LockedInput value={email} />
                </Field>

                <Field label="Address (Locked)">
                  <textarea
                    value={address ?? ""}
                    readOnly
                    disabled
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                  />
                </Field>

                <Field label="Vehicle Make (Locked)">
                  <LockedInput value={lockedVehicleMake} />
                </Field>

                <Field label="Vehicle Model (Locked)">
                  <LockedInput value={lockedVehicleModel} />
                </Field>

                <Field label="Chassis (Locked)">
                  <LockedInput value={lockedChassis} />
                </Field>

                <Field label="Engine (Locked)">
                  <LockedInput value={lockedEngine} />
                </Field>

                <Field label="Sale Date">
                  <TextInput type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                </Field>

                <Field label="Invoice Number *">
                  <TextInput value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                </Field>

                <Field label="Sale Price">
                  <TextInput type="number" value={String(salePrice)} onChange={(e) => setSalePrice(Number(e.target.value || 0))} />
                </Field>

                <Field label="Father Name *">
                  <TextInput value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
                </Field>

                <Field label="Age">
                  <TextInput value={age} onChange={(e) => setAge(e.target.value)} />
                </Field>

                <Field label="Nominee Name">
                  <TextInput value={nomineeName} onChange={(e) => setNomineeName(e.target.value)} />
                </Field>

               <Field label="Nominee Relation">
  <DropdownOrInput
    value={nomineeRelation}
    onChange={setNomineeRelation}
    options={ddNomineeRelations}
    placeholder="Enter nominee relation..."
    typeKey="nominee_relation"
  />
</Field>

                <Field label="Payment Type *">
                  <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as any)} className="w-full px-3 py-2 border rounded-lg bg-white">
                    <option value="cash">Cash</option>
                    <option value="finance">Finance</option>
                  </select>
                </Field>

                {paymentType === "finance" && (
                  <Field label="Finance Company *">
                    <DropdownOrInput value={financeCompany} onChange={setFinanceCompany} options={ddFinanceCompanies} placeholder="Enter finance company..." typeKey="finance_company" />
                  </Field>
                )}

                <Field label="Insurance Number *">
                  <TextInput value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)} />
                </Field>

                <Field label="Insurance Company *">
                  <DropdownOrInput value={insuranceCompany} onChange={setInsuranceCompany} options={ddInsuranceCompanies} placeholder="Enter insurance company..." typeKey="insurance_company" />
                </Field>

                <Field label="Insurance Broker *">
                  <DropdownOrInput value={insuranceBroker} onChange={setInsuranceBroker} options={ddInsuranceBrokers} placeholder="Enter insurance broker..." typeKey="insurance_broker" />
                </Field>

                <Field label="CPA">
                  <select value={cpaIncluded} onChange={(e) => setCpaIncluded(e.target.value as any)} className="w-full px-3 py-2 border rounded-lg bg-white">
                    <option value="included">Included</option>
                    <option value="not_included">Not Included</option>
                  </select>
                  <div className="text-xs text-gray-500 mt-1">If Not Included → CPA Insurance Number will appear.</div>
                </Field>

                {cpaIncluded === "not_included" && (
                  <Field label="CPA Insurance Number *">
                    <TextInput value={cpaInsuranceNumber} onChange={(e) => setCpaInsuranceNumber(e.target.value)} />
                  </Field>
                )}

                <Field label="Tyre">
                  <DropdownOrInput value={tyre} onChange={setTyre} options={ddTyres} placeholder="Enter tyre..." typeKey="tyre" />
                </Field>

                <Field label="Battery No">
                  <TextInput value={batteryNo} onChange={(e) => setBatteryNo(e.target.value)} />
                </Field>

                <Field label="Key No">
                  <TextInput value={keyNo} onChange={(e) => setKeyNo(e.target.value)} />
                </Field>

                <Field label="Helmet">
                  <DropdownOrInput value={helmet} onChange={setHelmet} options={ddHelmets} placeholder="Enter helmet..." typeKey="helmet" />
                </Field>

                <Field label="RC Required">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={rcRequired} onChange={(e) => setRcRequired(e.target.checked)} />
                    Yes
                  </label>
                </Field>

                <Field label="Aadhaar Required">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={aadhaarRequired} onChange={(e) => setAadhaarRequired(e.target.checked)} />
                    Yes
                  </label>
                </Field>

                {aadhaarRequired && (
                  <Field label="Aadhaar Number">
                    <TextInput value={aadhaarNumber} onChange={(e) => setAadhaarNumber(e.target.value)} />
                  </Field>
                )}

                <Field label="Notes">
                  <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </div>

              <div className="mt-6">
                <div className="font-semibold">Sales History (same chassis/engine)</div>
                {historyLoading ? (
                  <div className="text-sm text-gray-500 mt-2">Loading...</div>
                ) : history.length === 0 ? (
                  <div className="text-sm text-gray-500 mt-2">No previous sales found.</div>
                ) : (
                  <div className="mt-3 overflow-auto border rounded-xl">
                    <table className="min-w-[900px] w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3 text-left">Sale ID</th>
                          <th className="p-3 text-left">Customer</th>
                          <th className="p-3 text-left">Date</th>
                          <th className="p-3 text-left">Invoice</th>
                          <th className="p-3 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((r) => (
                          <tr key={r.id} className="border-t hover:bg-gray-50">
                            <td className="p-3">
                              <Link className="text-blue-600 hover:underline" href={`/sales/${r.id}`}>
                                #{r.id}
                              </Link>
                            </td>
                            <td className="p-3">{r.customer_name}</td>
                            <td className="p-3">{String(r.sale_date).slice(0, 10)}</td>
                            <td className="p-3">{r.invoice_number || "—"}</td>
                            <td className="p-3">{r.is_cancelled ? "Cancelled" : "Active"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}