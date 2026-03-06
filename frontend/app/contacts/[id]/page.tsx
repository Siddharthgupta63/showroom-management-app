"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { getUser } from "@/lib/auth";

type Phone = {
  id: number;
  phone: string;
  is_primary: number;
  is_active: number;
  added_at: string;
  deactivated_at: string | null;
};

type Vehicle = {
  id: number;
  chassis_number: string;
  engine_number: string;
  model_id: number | null;
  variant_id: number | null;
  model_name?: string | null;
  variant_name?: string | null;
  is_active?: number;
  created_at?: string;
  deactivated_at?: string | null;
};

type ContactDetail = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  notes: string | null;
  state: string | null;
  district: string | null;
  tehsil: string | null;
  address: string | null;
  primary_phone: string | null;
  phones: Phone[];
  vehicles: Vehicle[];
};

type ModelRow = { id: number; model_name: string; is_active: number };
type VariantRow = { id: number; model_id: number; variant_name: string; is_active: number };

function isTenDigit(v: string) {
  return /^[0-9]{10}$/.test(v.trim());
}

export default function ContactDetailPage() {
  return (
    <AuthGuard>
      <Inner />
    </AuthGuard>
  );
}

function Inner() {
  const params = useParams();
  const id = Number((params as any)?.id);

  // Hydration-safe role read (getUser uses localStorage)
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<string>("");
  useEffect(() => {
    setMounted(true);
    const u = getUser();
    setRole(String(u?.role || "").toLowerCase());
  }, []);

  const { hasPermission, loading: permsLoading } = usePermissions();
  const isOwnerAdmin = role === "owner" || role === "admin";

  const canView =
    isOwnerAdmin ||
    hasPermission("contacts_create") ||
    hasPermission("contacts_edit") ||
    hasPermission("contacts_import") ||
    hasPermission("contacts_delete");

  const canEdit = isOwnerAdmin || hasPermission("contacts_edit");
  const canDelete = isOwnerAdmin || hasPermission("contacts_delete");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [contact, setContact] = useState<ContactDetail | null>(null);

  // editable fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [tehsil, setTehsil] = useState("");
  const [address, setAddress] = useState("");

  // phones
  const [newPhone, setNewPhone] = useState("");
  const [newPhonePrimary, setNewPhonePrimary] = useState(false);
  const [busyPhoneId, setBusyPhoneId] = useState<number | null>(null);

  // vehicles + catalog
  const [models, setModels] = useState<ModelRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [vehChassis, setVehChassis] = useState("");
  const [vehEngine, setVehEngine] = useState("");
  const [vehModelId, setVehModelId] = useState<number | "">("");
  const [vehVariantId, setVehVariantId] = useState<number | "">("");
  const [busyVehicleId, setBusyVehicleId] = useState<number | null>(null);

  const activeModels = useMemo(() => models.filter((m) => Number(m.is_active) === 1), [models]);
  const activeVariants = useMemo(() => variants.filter((v) => Number(v.is_active) === 1), [variants]);

  const variantsForSelectedModel = useMemo(() => {
    if (vehModelId === "") return [];
    return activeVariants.filter((v) => Number(v.model_id) === Number(vehModelId));
  }, [activeVariants, vehModelId]);

  const fetchOne = async () => {
    if (!id || Number.isNaN(id)) {
      setErr("Invalid contact id");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const res = await api.get(`/api/contacts/${id}`);
      const data: ContactDetail = res.data?.data;

      setContact(data);
      setFirstName(String(data?.first_name || "").trim());
      setLastName(String(data?.last_name || "").trim());
      setNotes(String(data?.notes || ""));
      setState(String(data?.state || ""));
      setDistrict(String(data?.district || ""));
      setTehsil(String(data?.tehsil || ""));
      setAddress(String(data?.address || ""));
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to load contact");
      setContact(null);
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      const mRes = await api.get("/api/admin/vehicle-catalog/models");
      setModels(mRes.data?.data || []);
    } catch {}
  };

  const loadVariantsForModel = async (modelId: number) => {
    try {
      const vRes = await api.get("/api/admin/vehicle-catalog/variants", {
        params: { model_id: modelId },
      });
      const data: VariantRow[] = vRes.data?.data || [];
      setVariants((prev) => {
        const map = new Map<number, VariantRow>();
        [...prev, ...data].forEach((x) => map.set(x.id, x));
        return Array.from(map.values());
      });
    } catch {}
  };

  useEffect(() => {
    if (!permsLoading && canView) {
      fetchOne();
      loadModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permsLoading, canView, id]);

  const saveContact = async () => {
    if (!contact) return;
    if (!canEdit) return;

    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn) return setErr("First name is required");
    if (!ln) return setErr("Last name is required");

    setSaving(true);
    setErr(null);
    try {
      await api.put(`/api/contacts/${contact.id}`, {
        first_name: fn,
        last_name: ln,
        notes: notes?.trim() || null,
        state: state || null,
        district: district || null,
        tehsil: tehsil || null,
        address: address?.trim() || null,
      });
      await fetchOne();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const addPhone = async () => {
    if (!contact) return;
    if (!canEdit) return;

    const p = newPhone.trim();
    if (!isTenDigit(p)) {
      setErr("Mobile must be 10 digits");
      return;
    }

    setErr(null);
    try {
      await api.post(`/api/contacts/${contact.id}/phones`, {
        phone: p,
        is_primary: newPhonePrimary ? 1 : 0,
      });
      setNewPhone("");
      setNewPhonePrimary(false);
      await fetchOne();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to add mobile");
    }
  };

  const setPrimary = async (phoneId: number) => {
    if (!contact) return;
    if (!canEdit) return;

    setBusyPhoneId(phoneId);
    setErr(null);
    try {
      await api.put(`/api/contacts/${contact.id}/phones/${phoneId}/primary`);
      await fetchOne();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to set primary");
    } finally {
      setBusyPhoneId(null);
    }
  };

  const removePhone = async (phoneId: number) => {
    if (!contact) return;
    if (!canDelete) return;

    setBusyPhoneId(phoneId);
    setErr(null);
    try {
      await api.delete(`/api/contacts/${contact.id}/phones/${phoneId}`);
      await fetchOne();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to remove phone");
    } finally {
      setBusyPhoneId(null);
    }
  };

  const addVehicle = async () => {
    if (!contact) return;
    if (!canEdit) return;

    const c = vehChassis.trim();
    const e = vehEngine.trim();
    if (!c || !e) return setErr("Chassis number and engine number are required");

    setErr(null);
    try {
      await api.post(`/api/contacts/${contact.id}/vehicles`, {
        chassis_number: c,
        engine_number: e,
        model_id: vehModelId === "" ? null : vehModelId,
        variant_id: vehVariantId === "" ? null : vehVariantId,
      });
      setVehChassis("");
      setVehEngine("");
      setVehModelId("");
      setVehVariantId("");
      await fetchOne();
    } catch (ex: any) {
      setErr(ex?.response?.data?.message || "Failed to add vehicle");
    }
  };

  const removeVehicle = async (vehicleId: number) => {
    if (!contact) return;
    if (!canDelete) return;

    setBusyVehicleId(vehicleId);
    setErr(null);
    try {
      await api.delete(`/api/contacts/${contact.id}/vehicles/${vehicleId}`);
      await fetchOne();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to remove vehicle");
    } finally {
      setBusyVehicleId(null);
    }
  };

  const activePhones = (contact?.phones || []).filter((p) => Number(p.is_active) === 1);
  const vehicles = contact?.vehicles || [];

  return (
    <div className="p-6">
      {!permsLoading && !canView ? (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h1 className="text-2xl font-bold">Contact</h1>
          <p className="mt-2 text-sm text-gray-600">You don’t have permission to view Contacts.</p>
          <Link href="/dashboard" className="inline-block mt-4 px-4 py-2 rounded bg-gray-900 text-white">
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Contact</h1>
              <p className="text-sm text-gray-600">Customer profile with mobile history and vehicles.</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Link href="/contacts" className="px-4 py-2 rounded border bg-white">
                ← Back
              </Link>
              <button
                onClick={saveContact}
                disabled={!canEdit || saving || loading || !contact}
                title={!canEdit ? "No permission to edit" : undefined}
                className="bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {err && <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700">{err}</div>}

          {loading ? (
            <div className="text-gray-600">Loading...</div>
          ) : !contact ? (
            <div className="text-gray-600">Contact not found</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Contact Details */}
              <div className="bg-white rounded-xl shadow-md p-4">
                <h2 className="font-semibold mb-3">Contact Details</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">First Name *</label>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded disabled:opacity-60" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Last Name *</label>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded disabled:opacity-60" />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm text-gray-600 mb-1">Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded min-h-[90px] disabled:opacity-60" />
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">State</label>
                    <input value={state} onChange={(e) => setState(e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded disabled:opacity-60" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">District</label>
                    <input value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded disabled:opacity-60" />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Tehsil</label>
                    <input value={tehsil} onChange={(e) => setTehsil(e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded disabled:opacity-60" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Address</label>
                    <input value={address} onChange={(e) => setAddress(e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded disabled:opacity-60" />
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-700">
                  <div>
                    <span className="font-semibold">Primary Mobile:</span> {contact.primary_phone || "-"}
                  </div>
                </div>
              </div>

              {/* Phones */}
              <div className="bg-white rounded-xl shadow-md p-4">
                <h2 className="font-semibold mb-3">Mobiles</h2>

                <div className="space-y-2">
                  {activePhones.length === 0 ? (
                    <div className="text-sm text-gray-600">No active mobiles.</div>
                  ) : (
                    activePhones.map((p) => {
                      const primary = Number(p.is_primary) === 1;
                      const busy = busyPhoneId === p.id;

                      return (
                        <div key={p.id} className="border rounded p-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold">
                              {p.phone}{" "}
                              {primary && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">PRIMARY</span>}
                            </div>
                            <div className="text-xs text-gray-500">
                              Added: {mounted ? new Date(p.added_at).toLocaleString() : "-"}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setPrimary(p.id)}
                              disabled={!canEdit || primary || busy}
                              className="px-3 py-2 rounded border bg-white disabled:opacity-60"
                            >
                              Make Primary
                            </button>

                            <button
                              onClick={() => removePhone(p.id)}
                              disabled={!canDelete || busy}
                              className="px-3 py-2 rounded border bg-white disabled:opacity-60"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-4 border-t pt-4">
                  <div className="font-semibold mb-2">Add Mobile</div>
                  <div className="flex flex-col md:flex-row gap-2 items-center">
                    <input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="10-digit mobile"
                      disabled={!canEdit}
                      className="w-full md:flex-1 px-3 py-2 border rounded disabled:opacity-60"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={newPhonePrimary} onChange={(e) => setNewPhonePrimary(e.target.checked)} disabled={!canEdit} />
                      Make primary
                    </label>
                    <button onClick={addPhone} disabled={!canEdit} className="px-4 py-2 rounded bg-gray-900 text-white font-semibold disabled:opacity-60">
                      Add
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Mobile must be exactly 10 digits.</div>
                </div>
              </div>

              {/* Vehicles */}
              <div className="bg-white rounded-xl shadow-md p-4 lg:col-span-2">
                <h2 className="font-semibold mb-3">Vehicles</h2>

                <div className="space-y-2">
                  {vehicles.length === 0 ? (
                    <div className="text-sm text-gray-600">No vehicles.</div>
                  ) : (
                    vehicles.map((v) => {
                      const active = v.is_active == null ? true : Number(v.is_active) === 1;
                      const busy = busyVehicleId === v.id;

                      return (
                        <div key={v.id} className="border rounded p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold break-words">
                              {v.model_name || "-"} {v.variant_name ? `• ${v.variant_name}` : ""}
                              {!active && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">OLD</span>}
                            </div>
                            <div className="text-sm text-gray-700 break-words">
                              Chassis: {v.chassis_number} • Engine: {v.engine_number}
                            </div>
                          </div>

                          <button
                            onClick={() => removeVehicle(v.id)}
                            disabled={!canDelete || busy}
                            className="px-3 py-2 rounded border bg-white disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-4 border-t pt-4">
                  <div className="font-semibold mb-2">Add Vehicle</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Chassis Number *</label>
                      <input value={vehChassis} onChange={(e) => setVehChassis(e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded disabled:opacity-60" />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Engine Number *</label>
                      <input value={vehEngine} onChange={(e) => setVehEngine(e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded disabled:opacity-60" />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Model</label>
                      <select
                        value={vehModelId === "" ? "" : String(vehModelId)}
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (!val) {
                            setVehModelId("");
                            setVehVariantId("");
                            return;
                          }
                          const mid = Number(val);
                          setVehModelId(mid);
                          setVehVariantId("");
                          await loadVariantsForModel(mid);
                        }}
                        disabled={!canEdit}
                        className="w-full px-3 py-2 border rounded disabled:opacity-60"
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
                        value={vehVariantId === "" ? "" : String(vehVariantId)}
                        onChange={(e) => setVehVariantId(e.target.value ? Number(e.target.value) : "")}
                        disabled={!canEdit || vehModelId === ""}
                        className="w-full px-3 py-2 border rounded disabled:opacity-60"
                      >
                        <option value="">Select Variant</option>
                        {variantsForSelectedModel.map((vv) => (
                          <option key={vv.id} value={vv.id}>
                            {vv.variant_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3">
                    <button onClick={addVehicle} disabled={!canEdit} className="px-4 py-2 rounded bg-gray-900 text-white font-semibold disabled:opacity-60">
                      Add Vehicle
                    </button>
                    <div className="text-xs text-gray-500 mt-1">Chassis + Engine required. Model/Variant optional.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
