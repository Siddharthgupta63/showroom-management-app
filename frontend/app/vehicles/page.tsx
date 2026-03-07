"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { getUser } from "@/lib/auth";

type VehicleRow = {
  id: number;
  contact_id?: number | null;
  chassis_number?: string | null;
  engine_number?: string | null;
  model_id?: number | null;
  variant_id?: number | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  color?: string | null;
  created_at?: string | null;
};

type DDItem = { id: number; value: string; label?: string | null };

function formatColorLabel(item: DDItem) {
  return item.label ? `${item.value} — ${item.label}` : item.value;
}

export default function VehiclesPage() {
  const { hasPermission, loading: permsLoading } = usePermissions();

  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    setRole(String(u?.role || "").toLowerCase());
  }, []);

  const isOwnerAdmin = role === "owner" || role === "admin";

  const canView = true;
  const canExport = isOwnerAdmin || hasPermission("export_excel");
  const canImport = isOwnerAdmin || hasPermission("import_excel") || hasPermission("bulk_upload");

  // ✅ changed: Add Vehicle visible for all staff
  const canAddVehicle = true;

  const canDelete = isOwnerAdmin;

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [colorMap, setColorMap] = useState<Map<string, DDItem>>(new Map());

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

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

  const fetchVehicles = async (opts?: { forcePage?: number; forceQ?: string; forcePageSize?: number }) => {
    if (!canView) return;

    const useQ = (opts?.forceQ ?? q).trim();
    const usePage = Math.max(1, opts?.forcePage ?? page);
    const usePageSize = Math.min(200, Math.max(10, opts?.forcePageSize ?? pageSize));

    setLoading(true);
    setErr("");

    try {
      const params: any = { page: usePage, pageSize: usePageSize };
      if (useQ) params.q = useQ;

      const res = await api.get("/api/vehicles", { params });

      setRows(res.data?.data || []);
      setTotal(Number(res.data?.total || 0));
      setPage(usePage);
      setPageSize(usePageSize);
    } catch (e: any) {
      setRows([]);
      setTotal(0);
      setErr(e?.response?.data?.message || "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permsLoading && canView) {
      loadColorDropdown();
      fetchVehicles({ forcePage: 1 });
    }
    // eslint-disable-next-line
  }, [permsLoading, canView]);

  useEffect(() => {
    if (!permsLoading && canView) fetchVehicles();
    // eslint-disable-next-line
  }, [page, pageSize]);

  const onSearch = () => fetchVehicles({ forcePage: 1, forceQ: q });
  const onReset = () => {
    setQ("");
    fetchVehicles({ forcePage: 1, forceQ: "" });
  };

  const downloadTemplate = async () => {
    const res = await api.get("/api/vehicles/_import/template", { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vehicles_import_template.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    const res = await api.get("/api/vehicles/_export", {
      responseType: "blob",
      params: { q: q.trim() },
    });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vehicles_export.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const importExcel = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    await api.post("/api/vehicles/_import", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    await fetchVehicles({ forcePage: 1 });
  };

  const deleteVehicle = async (id: number) => {
    if (!canDelete) return;

    const ok = window.confirm("Delete this vehicle? (Recommended: only delete if not used in sales)");
    if (!ok) return;

    try {
      await api.delete(`/api/vehicles/${id}`);
      await fetchVehicles();
      alert("Deleted ✅");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Delete failed");
    }
  };

  const goFirst = () => setPage(1);
  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));
  const goLast = () => setPage(totalPages);

  const disableFirstPrev = page <= 1 || loading;
  const disableNextLast = page >= totalPages || loading;

  return (
    <AuthGuard>
      <div className="p-6">
        {!mounted ? null : !permsLoading && !canView ? (
          <div className="bg-white p-6 rounded-xl shadow">
            <h1 className="text-xl font-bold">Vehicles</h1>
            <p className="mt-2 text-gray-600">No permission.</p>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold">Vehicles</h1>
                <p className="text-sm text-gray-500">Search by chassis / engine / make / model</p>
              </div>

              <div className="flex gap-2 flex-wrap items-center">
                {canAddVehicle && (
                  <Link href="/vehicles/new" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                    + Add Vehicle
                  </Link>
                )}

                {canExport && (
                  <button
                    onClick={async () => {
                      try {
                        await exportExcel();
                      } catch {
                        alert("Export failed");
                      }
                    }}
                    className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
                  >
                    Export
                  </button>
                )}

                {canImport && (
                  <>
                    <button
                      onClick={async () => {
                        try {
                          await downloadTemplate();
                        } catch {
                          alert("Template download failed");
                        }
                      }}
                      className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
                    >
                      Sample Excel
                    </button>

                    <label className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 cursor-pointer">
                      Import
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            await importExcel(f);
                            alert("Import done ✅");
                          } catch (err: any) {
                            alert(err?.response?.data?.message || "Import failed");
                          } finally {
                            e.currentTarget.value = "";
                          }
                        }}
                      />
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[260px]">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="w-full border rounded-lg px-3 py-2"
                />
                <div className="mt-2 flex gap-2">
                  <button onClick={onSearch} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                    Search
                  </button>
                  <button onClick={onReset} className="px-4 py-2 border rounded-lg">
                    Reset
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm">Page size</label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPage(1);
                    setPageSize(Number(e.target.value));
                  }}
                  className="block border rounded-lg px-3 py-2"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

            <div className="mt-4 overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 border-b">ID</th>
                    <th className="px-3 py-2 border-b">Chassis</th>
                    <th className="px-3 py-2 border-b">Engine</th>
                    <th className="px-3 py-2 border-b">Make</th>
                    <th className="px-3 py-2 border-b">Model</th>
                    <th className="px-3 py-2 border-b">Color</th>
                    <th className="px-3 py-2 border-b text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-3">
                        Loading…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-3 text-gray-500">
                        No vehicles found
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 border-b">{r.id}</td>
                        <td className="px-3 py-2 border-b">{r.chassis_number || "-"}</td>
                        <td className="px-3 py-2 border-b">{r.engine_number || "-"}</td>
                        <td className="px-3 py-2 border-b">{r.vehicle_make || "-"}</td>
                        <td className="px-3 py-2 border-b">{r.vehicle_model || "-"}</td>
                        <td className="px-3 py-2 border-b">{displayColor(r.color)}</td>

                        <td className="px-3 py-2 border-b text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/vehicles/${r.id}`} className="px-3 py-1.5 border rounded-lg">
                              View
                            </Link>

                            {r.contact_id ? (
                              <Link href={`/contacts/${r.contact_id}`} className="px-3 py-1.5 border rounded-lg">
                                Contact
                              </Link>
                            ) : null}

                            {canDelete && (
                              <button
                                onClick={() => deleteVehicle(r.id)}
                                className="px-3 py-1.5 border rounded-lg text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-between items-center flex-wrap gap-2">
              <div className="text-sm">Total: {total}</div>

              <div className="flex gap-2">
                <button onClick={goFirst} disabled={disableFirstPrev} className="px-3 py-2 border rounded-lg">
                  ⏮
                </button>
                <button onClick={goPrev} disabled={disableFirstPrev} className="px-3 py-2 border rounded-lg">
                  ◀
                </button>
                <span className="px-3 py-2 text-sm">
                  Page {page} / {totalPages}
                </span>
                <button onClick={goNext} disabled={disableNextLast} className="px-3 py-2 border rounded-lg">
                  ▶
                </button>
                <button onClick={goLast} disabled={disableNextLast} className="px-3 py-2 border rounded-lg">
                  ⏭
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}