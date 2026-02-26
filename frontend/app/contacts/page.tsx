"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { getUser } from "@/lib/auth";

type ContactRow = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  primary_phone?: string | null;
  district?: string | null;
  tehsil?: string | null;
};

export default function ContactsPage() {
  const { hasPermission, loading: permsLoading } = usePermissions();

  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    setRole(String(u?.role || "").toLowerCase());
  }, []);

  const isOwnerAdmin = role === "owner" || role === "admin";

  const canView =
    isOwnerAdmin ||
    hasPermission("contacts_create") ||
    hasPermission("contacts_edit") ||
    hasPermission("contacts_import") ||
    hasPermission("contacts_delete");

  const canCreate = isOwnerAdmin || hasPermission("contacts_create");
  const canEdit = isOwnerAdmin || hasPermission("contacts_edit");
  const canImport = isOwnerAdmin || hasPermission("contacts_import");
  const canExport = isOwnerAdmin || hasPermission("export_excel");

  // ---- search + pagination ----
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState<number>(0);

  const totalPages = useMemo(() => {
    const tp = Math.max(1, Math.ceil((total || 0) / (pageSize || 1)));
    return tp;
  }, [total, pageSize]);

  const prettyName = (r: ContactRow) => {
    const fn = (r.first_name || "").trim();
    const ln = (r.last_name || "").trim();
    const full = (r.full_name || "").trim();
    return full || `${fn} ${ln}`.trim() || `Contact #${r.id}`;
  };

  const fetchContacts = async (opts?: { forcePage?: number; forceQ?: string; forcePageSize?: number }) => {
    if (!canView) return;

    const useQ = (opts?.forceQ ?? q).trim();
    const usePage = Math.max(1, Number(opts?.forcePage ?? page) || 1);
    const usePageSize = Math.min(200, Math.max(10, Number(opts?.forcePageSize ?? pageSize) || 10));

    setLoading(true);
    setErr("");

    try {
      const params: any = { page: usePage, pageSize: usePageSize };
      if (useQ) params.q = useQ;

      const res = await api.get("/api/contacts", { params });

      const list: ContactRow[] = res.data?.data || [];
      const t = Number(res.data?.total || 0);

      setRows(list);
      setTotal(Number.isFinite(t) ? t : 0);

      setPage(usePage);
      setPageSize(usePageSize);
    } catch (e: any) {
      setRows([]);
      setTotal(0);
      setErr(e?.response?.data?.message || e?.message || "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permsLoading && canView) fetchContacts({ forcePage: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permsLoading, canView]);

  useEffect(() => {
    if (!permsLoading && canView) fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const onSearch = async () => fetchContacts({ forcePage: 1, forceQ: q });
  const onReset = async () => {
    setQ("");
    await fetchContacts({ forcePage: 1, forceQ: "" });
  };

  // ---- Export / Template / Import (uses backend /_export and /_import) ----
  const downloadTemplate = async () => {
    const res = await api.get("/api/contacts/_import/template", { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts_import_template.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    const res = await api.get("/api/contacts/_export", {
      responseType: "blob",
      params: { q: q.trim() },
    });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts_export.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const importExcel = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    await api.post("/api/contacts/_import", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    await fetchContacts({ forcePage: 1 });
  };

  // ---- Pagination buttons ----
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
          <div className="bg-white rounded-xl shadow-md p-6">
            <h1 className="text-2xl font-bold">Contacts</h1>
            <p className="mt-2 text-sm text-gray-600">You don’t have permission to view Contacts.</p>
            <Link href="/dashboard" className="inline-block mt-4 px-4 py-2 rounded bg-gray-900 text-white">
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold">Contacts</h1>
                <p className="text-sm text-gray-500">Search by name / mobile / chassis / engine</p>
              </div>

              <div className="flex gap-2 flex-wrap items-center">
                {canExport && (
                  <button
                    onClick={async () => {
                      try { await exportExcel(); } catch { alert("Export failed"); }
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
                        try { await downloadTemplate(); } catch { alert("Template download failed"); }
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

                {canCreate && (
                  <Link href="/contacts/new" className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black">
                    + New Contact
                  </Link>
                )}
              </div>
            </div>

            {/* Search row + page size */}
            <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[260px]">
                <label className="text-sm font-medium text-gray-700">Search</label>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Name / mobile / chassis / engine…"
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={onSearch}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Search
                  </button>
                  <button
                    onClick={onReset}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="min-w-[160px]">
                <label className="text-sm font-medium text-gray-700">Page size</label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const ps = Number(e.target.value);
                    setPage(1);
                    setPageSize(ps);
                  }}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}

            {/* Table */}
            <div className="mt-4 overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="px-3 py-2 border-b">ID</th>
                    <th className="px-3 py-2 border-b">Name</th>
                    <th className="px-3 py-2 border-b">Primary Mobile</th>
                    <th className="px-3 py-2 border-b text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="px-3 py-3" colSpan={4}>Loading…</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td className="px-3 py-3 text-gray-500" colSpan={4}>No contacts found.</td></tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 border-b">{r.id}</td>
                        <td className="px-3 py-2 border-b">{prettyName(r)}</td>
                        <td className="px-3 py-2 border-b">{r.primary_phone || "-"}</td>
                        <td className="px-3 py-2 border-b text-right">
                          <div className="inline-flex gap-2">
                            <Link href={`/contacts/${r.id}`} className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50">
                              View
                            </Link>
                            {canEdit && (
                              <Link href={`/contacts/${r.id}`} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-black">
                                Edit
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-gray-600">
                Total: <span className="font-medium">{total}</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={goFirst}
                  disabled={disableFirstPrev}
                  className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  ⏮ First
                </button>
                <button
                  onClick={goPrev}
                  disabled={disableFirstPrev}
                  className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  ◀ Prev
                </button>

                <div className="px-3 py-2 text-sm">
                  Page <span className="font-medium">{page}</span> /{" "}
                  <span className="font-medium">{totalPages}</span>
                </div>

                <button
                  onClick={goNext}
                  disabled={disableNextLast}
                  className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next ▶
                </button>
                <button
                  onClick={goLast}
                  disabled={disableNextLast}
                  className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Last ⏭
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
