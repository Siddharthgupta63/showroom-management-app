"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";

type Vehicle = {
  id: number;
  contact_id?: number | null;
  chassis_number?: string | null;
  engine_number?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  color?: string | null; // stored as code (BKB)
  created_at?: string | null;
  is_deleted?: number;
};

type SaleLink = {
  sale_id: number;
};

type TimelineEvent = {
  type: string;
  at: string;
  meta?: { sale_id?: number };
};

type DDItem = { id: number; value: string; label?: string | null };

function formatColorLabel(item: DDItem) {
  return item.label ? `${item.value} — ${item.label}` : item.value;
}

export default function VehicleViewPage() {
  const { id } = useParams();
  const router = useRouter();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [sales, setSales] = useState<SaleLink[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ✅ NEW: color lookup map
  const [colorMap, setColorMap] = useState<Map<string, DDItem>>(new Map());

  const user = getUser();
  const role = String(user?.role || "").toLowerCase();

  const isOwnerAdmin = role === "owner" || role === "admin";
  const canEdit = role === "owner" || role === "admin" || role === "manager";

  const loadColorDropdown = async () => {
    try {
      const res = await api.get("/api/dropdowns", { params: { types: "vehicle_color" } });
      const list: DDItem[] = (res.data?.data?.vehicle_color || [])
        .map((x: any) => ({
          id: Number(x.id),
          value: String(x.value || ""),
          label: x.label ? String(x.label) : null,
        }))
        .filter((x: DDItem) => x.value);

      const m = new Map<string, DDItem>();
      for (const it of list) m.set(String(it.value).trim().toUpperCase(), it);
      setColorMap(m);
    } catch {
      setColorMap(new Map());
    }
  };

  const displayColor = (code?: string | null) => {
    const c = String(code || "").trim();
    if (!c) return "-";
    const hit = colorMap.get(c.toUpperCase());
    return hit ? formatColorLabel(hit) : c;
  };

  const fetchVehicle = async () => {
    try {
      setLoading(true);
      setErr("");

      // load dropdown map (display-only)
      await loadColorDropdown();

      const res = await api.get(`/api/vehicles/${id}`);
      setVehicle(res.data?.data || null);

      // Linked sales
      try {
        const sres = await api.get(`/api/vehicles/${id}/sales`);
        setSales(sres.data?.data || []);
      } catch {
        setSales([]);
      }

      // Timeline
      try {
        const tres = await api.get(`/api/vehicles/${id}/timeline`);
        setTimeline(tres.data?.data || []);
      } catch {
        setTimeline([]);
      }
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to load vehicle");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchVehicle();
    // eslint-disable-next-line
  }, [id]);

  const deleteVehicle = async () => {
    if (!isOwnerAdmin) return;

    const ok = window.confirm("Delete this vehicle?\n\n⚠ Cannot delete if linked to sale.");
    if (!ok) return;

    try {
      await api.delete(`/api/vehicles/${id}`);
      alert("Deleted ✅");
      router.push("/vehicles");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Delete failed");
    }
  };

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="bg-white p-6 rounded-xl shadow">
          {loading ? (
            <p>Loading...</p>
          ) : err ? (
            <p className="text-red-600">{err}</p>
          ) : !vehicle ? (
            <p>Vehicle not found</p>
          ) : (
            <>
              {/* Header */}
              <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-bold">Vehicle #{vehicle.id}</h1>
                  <p className="text-sm text-gray-500">Created at: {vehicle.created_at || "-"}</p>

                  {vehicle.is_deleted === 1 && (
                    <span className="inline-block mt-2 px-3 py-1 text-xs bg-red-100 text-red-700 rounded">
                      Deleted
                    </span>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Link href="/vehicles" className="px-4 py-2 border rounded-lg">
                    Back
                  </Link>

                  {canEdit && (
                    <Link href={`/vehicles/${id}/edit`} className="px-4 py-2 border rounded-lg bg-blue-600 text-white">
                      Edit
                    </Link>
                  )}

                  {isOwnerAdmin && (
                    <button
                      onClick={deleteVehicle}
                      className="px-4 py-2 border rounded-lg text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <Detail label="Chassis Number" value={vehicle.chassis_number} />
                <Detail label="Engine Number" value={vehicle.engine_number} />
                <Detail label="Make" value={vehicle.vehicle_make} />
                <Detail label="Model" value={vehicle.vehicle_model} />

                {/* ✅ NEW: show formatted color */}
                <Detail label="Color" value={displayColor(vehicle.color)} />

                <div>
                  <p className="font-medium text-gray-600">Linked Contact</p>
                  {vehicle.contact_id ? (
                    <Link href={`/contacts/${vehicle.contact_id}`} className="text-blue-600 underline">
                      View Contact #{vehicle.contact_id}
                    </Link>
                  ) : (
                    <p className="text-gray-500">Not linked</p>
                  )}
                </div>
              </div>

              {/* Linked Sales */}
              <div className="mt-8">
                <h2 className="text-lg font-semibold mb-2">Linked Sales</h2>

                {sales.length === 0 ? (
                  <p className="text-gray-500 text-sm">No sales linked.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {sales.map((s) => (
                      <Link
                        key={s.sale_id}
                        href={`/sales/${s.sale_id}`}
                        className="px-3 py-1.5 border rounded-lg text-blue-600"
                      >
                        Sale #{s.sale_id}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="mt-8">
                <h2 className="text-lg font-semibold mb-2">Timeline</h2>

                {timeline.length === 0 ? (
                  <p className="text-gray-500 text-sm">No timeline events.</p>
                ) : (
                  <div className="space-y-2">
                    {timeline.map((e, i) => (
                      <div key={i} className="border rounded-lg p-3 text-sm bg-gray-50">
                        <div className="font-medium">{e.type}</div>
                        <div className="text-gray-500">{e.at}</div>
                        {e.meta?.sale_id && (
                          <Link href={`/sales/${e.meta.sale_id}`} className="text-blue-600 underline">
                            Sale #{e.meta.sale_id}
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="font-medium text-gray-600">{label}</p>
      <p>{value || "-"}</p>
    </div>
  );
}