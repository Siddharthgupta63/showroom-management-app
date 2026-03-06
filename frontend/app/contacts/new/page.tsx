"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { getUser } from "@/lib/auth";

type ModelRow = { id: number; model_name: string; is_active: number };
type VariantRow = { id: number; model_id: number; variant_name: string; is_active: number };

type PhoneRow = { id: string; phone: string; is_primary: boolean };
type VehicleRow = {
  id: string;
  chassis_number: string;
  engine_number: string;
  model_id: number | "";
  variant_id: number | "";
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function isTenDigit(s: string) {
  return /^[0-9]{10}$/.test(s.trim());
}

const STATES = ["Madhya Pradesh"];
const DISTRICTS_BY_STATE: Record<string, string[]> = {
  "Madhya Pradesh": ["Umaria", "Shahdol", "Katni"],
};
const TEHSILS_BY_DISTRICT: Record<string, string[]> = {
  Umaria: ["Bandhavgarh", "Manpur", "Pali"],
  Shahdol: ["Sohagpur", "Beohari", "Jaisinghnagar"],
  Katni: ["Rithi", "Vijayraghavgarh", "Bahoriband"],
};

export default function NewContactPage() {
  const router = useRouter();

  const { hasPermission, loading: permsLoading } = usePermissions();
  const u = getUser();
  const role = String(u?.role || "").toLowerCase();
  const isOwnerAdmin = role === "owner" || role === "admin";
  const canCreate = isOwnerAdmin || hasPermission("contacts_create");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [notes, setNotes] = useState("");

  const [state, setState] = useState("Madhya Pradesh");
  const [district, setDistrict] = useState("");
  const [tehsil, setTehsil] = useState("");
  const [address, setAddress] = useState("");

  const [phones, setPhones] = useState<PhoneRow[]>([{ id: uid(), phone: "", is_primary: true }]);

  const [vehicles, setVehicles] = useState<VehicleRow[]>([
    { id: uid(), chassis_number: "", engine_number: "", model_id: "", variant_id: "" },
  ]);

  const [models, setModels] = useState<ModelRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeModels = useMemo(() => models.filter((m) => Number(m.is_active) === 1), [models]);
  const activeVariants = useMemo(() => variants.filter((v) => Number(v.is_active) === 1), [variants]);

  useEffect(() => {
    (async () => {
      try {
        const mRes = await api.get("/api/admin/vehicle-catalog/models");
        setModels(mRes.data?.data || []);
      } catch {}
    })();
  }, []);

  const loadVariantsForModel = async (modelId: number) => {
    try {
      const res = await api.get("/api/admin/vehicle-catalog/variants", { params: { model_id: modelId } });
      const data: VariantRow[] = res.data?.data || [];
      setVariants((prev) => {
        const map = new Map<number, VariantRow>();
        [...prev, ...data].forEach((x) => map.set(x.id, x));
        return Array.from(map.values());
      });
    } catch {}
  };

  useEffect(() => {
    const list = DISTRICTS_BY_STATE[state] || [];
    if (list.length && district && !list.includes(district)) setDistrict("");
    setTehsil("");
  }, [state]);

  useEffect(() => {
    const list = TEHSILS_BY_DISTRICT[district] || [];
    if (list.length && tehsil && !list.includes(tehsil)) setTehsil("");
  }, [district]);

  const setPrimary = (id: string) => {
    setPhones((prev) => prev.map((p) => ({ ...p, is_primary: p.id === id })));
  };

  const addPhoneRow = () => setPhones((p) => [...p, { id: uid(), phone: "", is_primary: false }]);

  const removePhoneRow = (id: string) => {
    setPhones((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (next.length === 0) return [{ id: uid(), phone: "", is_primary: true }];
      if (!next.some((p) => p.is_primary)) next[0].is_primary = true;
      return [...next];
    });
  };

  const addVehicleRow = () =>
    setVehicles((v) => [...v, { id: uid(), chassis_number: "", engine_number: "", model_id: "", variant_id: "" }]);

  const removeVehicleRow = (id: string) => {
    setVehicles((prev) => {
      const next = prev.filter((v) => v.id !== id);
      if (next.length === 0) return [{ id: uid(), chassis_number: "", engine_number: "", model_id: "", variant_id: "" }];
      return next;
    });
  };

  const submit = async () => {
    setError(null);

    if (!canCreate) return setError("Permission denied: cannot create contacts");

    if (!firstName.trim()) return setError("First name is required");
    if (!lastName.trim()) return setError("Last name is required");

    const cleanedPhones = phones
      .map((p) => ({
        phone: p.phone.trim(),
        is_primary: p.is_primary ? 1 : 0,
      }))
      .filter((p) => p.phone);

    const validPhones = cleanedPhones.filter((p) => isTenDigit(p.phone));
    if (validPhones.length === 0) return setError("Mobile is required (10 digits)");
    if (!validPhones.some((p) => p.is_primary === 1)) validPhones[0].is_primary = 1;

    const cleanedVehicles = vehicles
      .map((v) => ({
        chassis_number: v.chassis_number.trim(),
        engine_number: v.engine_number.trim(),
        model_id: v.model_id === "" ? null : v.model_id,
        variant_id: v.variant_id === "" ? null : v.variant_id,
      }))
      .filter((v) => v.chassis_number || v.engine_number);

    for (const v of cleanedVehicles) {
      if (!v.chassis_number || !v.engine_number) {
        return setError("Each vehicle must have BOTH chassis number and engine number");
      }
    }

    try {
      setSaving(true);
      const res = await api.post("/api/contacts", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        notes: notes.trim() || null,
        state: state || null,
        district: district || null,
        tehsil: tehsil || null,
        address: address.trim() || null,
        phones: validPhones,
        vehicles: cleanedVehicles,
      });

      const newId = res.data?.data?.id;
      if (newId) router.push(`/contacts/${newId}`);
      else router.push("/contacts");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to create contact");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className="p-6">
        {!permsLoading && !canCreate ? (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h1 className="text-2xl font-bold">New Contact</h1>
            <p className="mt-2 text-sm text-gray-600">You don’t have permission to create contacts.</p>
            <Link href="/contacts" className="inline-block mt-4 px-4 py-2 rounded bg-gray-900 text-white">
              Back to Contacts
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold">New Contact</h1>
                <p className="text-sm text-gray-600">First/Last name + mobile required. Mobile must be 10 digits.</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Link href="/contacts" className="px-4 py-2 rounded border bg-white">
                  ← Back
                </Link>
                <button
                  onClick={submit}
                  disabled={saving || permsLoading || !canCreate}
                  className="bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {error && <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700">{error}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Contact Details */}
              <div className="bg-white rounded-xl shadow-md p-4">
                <h2 className="font-semibold mb-3">Contact Details</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">First Name *</label>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-3 py-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Last Name *</label>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-3 py-2 border rounded" />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm text-gray-600 mb-1">State</label>
                  <select value={state} onChange={(e) => setState(e.target.value)} className="w-full px-3 py-2 border rounded">
                    {STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">District</label>
                    <select value={district} onChange={(e) => setDistrict(e.target.value)} className="w-full px-3 py-2 border rounded">
                      <option value="">Select District</option>
                      {(DISTRICTS_BY_STATE[state] || []).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Tehsil</label>
                    <select value={tehsil} onChange={(e) => setTehsil(e.target.value)} className="w-full px-3 py-2 border rounded">
                      <option value="">Select Tehsil</option>
                      {(TEHSILS_BY_DISTRICT[district] || []).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm text-gray-600 mb-1">Address</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>

                <div className="mt-3">
                  <label className="block text-sm text-gray-600 mb-1">Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border rounded min-h-[90px]" />
                </div>
              </div>

              {/* Phones */}
              <div className="bg-white rounded-xl shadow-md p-4">
                <h2 className="font-semibold mb-3">Mobiles</h2>

                <div className="space-y-2">
                  {phones.map((p) => (
                    <div key={p.id} className="border rounded p-3">
                      <div className="flex flex-col md:flex-row gap-2 md:items-center">
                        <input
                          value={p.phone}
                          onChange={(e) =>
                            setPhones((prev) => prev.map((x) => (x.id === p.id ? { ...x, phone: e.target.value } : x)))
                          }
                          placeholder="10-digit mobile"
                          className="flex-1 px-3 py-2 border rounded"
                        />

                        <button
                          onClick={() => setPrimary(p.id)}
                          className={`px-3 py-2 rounded border ${p.is_primary ? "bg-green-100 border-green-200" : "bg-white"}`}
                          type="button"
                        >
                          {p.is_primary ? "Primary" : "Make Primary"}
                        </button>

                        <button onClick={() => removePhoneRow(p.id)} className="px-3 py-2 border rounded" type="button">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={addPhoneRow} className="mt-3 px-4 py-2 rounded bg-gray-900 text-white font-semibold" type="button">
                  + Add Mobile
                </button>

                <div className="text-xs text-gray-500 mt-2">At least 1 valid 10-digit mobile is required.</div>
              </div>

              {/* Vehicles */}
              <div className="bg-white rounded-xl shadow-md p-4 lg:col-span-2">
                <h2 className="font-semibold mb-3">Vehicles</h2>

                <div className="space-y-2">
                  {vehicles.map((v) => {
                    const variantsForModel =
                      v.model_id === ""
                        ? []
                        : activeVariants.filter((x) => Number(x.model_id) === Number(v.model_id));

                    return (
                      <div key={v.id} className="border rounded p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Chassis Number</label>
                            <input
                              value={v.chassis_number}
                              onChange={(e) =>
                                setVehicles((prev) =>
                                  prev.map((x) => (x.id === v.id ? { ...x, chassis_number: e.target.value } : x))
                                )
                              }
                              className="w-full px-3 py-2 border rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Engine Number</label>
                            <input
                              value={v.engine_number}
                              onChange={(e) =>
                                setVehicles((prev) =>
                                  prev.map((x) => (x.id === v.id ? { ...x, engine_number: e.target.value } : x))
                                )
                              }
                              className="w-full px-3 py-2 border rounded"
                            />
                          </div>

                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Model</label>
                            <select
                              value={v.model_id === "" ? "" : String(v.model_id)}
                              onChange={async (e) => {
                                const val = e.target.value;
                                const mid = val ? Number(val) : "";
                                setVehicles((prev) =>
                                  prev.map((x) => (x.id === v.id ? { ...x, model_id: mid, variant_id: "" } : x))
                                );
                                if (mid !== "") await loadVariantsForModel(mid);
                              }}
                              className="w-full px-3 py-2 border rounded"
                            >
                              <option value="">Select Model</option>
                              {activeModels.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.model_name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Variant</label>
                            <select
                              value={v.variant_id === "" ? "" : String(v.variant_id)}
                              onChange={(e) => {
                                const val = e.target.value;
                                setVehicles((prev) =>
                                  prev.map((x) => (x.id === v.id ? { ...x, variant_id: val ? Number(val) : "" } : x))
                                );
                              }}
                              disabled={v.model_id === ""}
                              className="w-full px-3 py-2 border rounded disabled:opacity-60"
                            >
                              <option value="">Select Variant</option>
                              {variantsForModel.map((vv) => (
                                <option key={vv.id} value={vv.id}>
                                  {vv.variant_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="mt-3">
                          <button onClick={() => removeVehicleRow(v.id)} className="px-3 py-2 border rounded" type="button">
                            Remove Vehicle Row
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button onClick={addVehicleRow} className="mt-3 px-4 py-2 rounded bg-gray-900 text-white font-semibold" type="button">
                  + Add Vehicle
                </button>

                <div className="text-xs text-gray-500 mt-2">If vehicle added, chassis + engine must be filled.</div>
              </div>
            </div>
          </>
        )}
      </div>
    </AuthGuard>
  );
}
