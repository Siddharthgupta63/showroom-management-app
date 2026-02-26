"use client";

import React, { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

type Perm = { permission_key: string; description: string | null };

const ROLES = [
  "owner",
  "admin",
  "manager",
  "sales",
  "insurance",
  "vahan",
  "hsrp",
  "renewal",
  "rc",
];

function categoryOf(key: string) {
  const k = (key || "").toLowerCase();

  if (k.includes("whatsapp")) return "WhatsApp";
  if (k.includes("insurance") || k.includes("renew")) return "Insurance";
  if (k.includes("manage_") || k.includes("permission")) return "Admin";
  if (k.includes("import") || k.includes("export") || k.includes("excel") || k.includes("bulk"))
    return "Import / Export";

  return "Other";
}

export default function CreateUserPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    mobile: "",
    password: "",
    role: "sales",
    is_active: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [search, setSearch] = useState("");

  const [permissions, setPermissions] = useState<Perm[]>([]);
  const [extraPerms, setExtraPerms] = useState<string[]>([]);

  // Load permissions catalog
  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/api/admin/permissions-catalog");
        if (res.data?.success) {
          setPermissions(res.data.permissions || []);
        }
      } catch {
        // ignore
      }
    }
    load();
  }, []);

  // Create page: role defaults are NOT locked here (we are selecting EXTRAS only)
  const defaultPerms = useMemo(() => new Set<string>(), []);

  const groupedPermissions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = !q
      ? permissions
      : permissions.filter((p) => {
          const key = (p.permission_key || "").toLowerCase();
          const desc = (p.description || "").toLowerCase();
          return key.includes(q) || desc.includes(q);
        });

    const map: Record<string, Perm[]> = {};
    for (const p of filtered) {
      const cat = categoryOf(p.permission_key);
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    }

    // stable order
    const orderedCats = ["Insurance", "WhatsApp", "Admin", "Import / Export", "Other"];
    const ordered: Record<string, Perm[]> = {};
    for (const cat of orderedCats) {
      if (map[cat]?.length) {
        ordered[cat] = map[cat].slice().sort((a, b) => a.permission_key.localeCompare(b.permission_key));
      }
    }
    return ordered;
  }, [permissions, search]);

  function handleChange(e: any) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function togglePerm(key: string) {
    if (defaultPerms.has(key)) return;
    setExtraPerms((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }

  function selectAllVisible() {
    const allVisibleKeys = Object.values(groupedPermissions)
      .flat()
      .map((p) => p.permission_key);

    const set = new Set(extraPerms);
    for (const k of allVisibleKeys) set.add(k);
    setExtraPerms(Array.from(set).sort());
  }

  function clearAll() {
    setExtraPerms([]);
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!form.username.trim() && !form.email.trim() && !form.mobile.trim()) {
      setSaving(false);
      setError("Please fill at least one: Username OR Email OR Mobile.");
      return;
    }
    if (!form.password.trim()) {
      setSaving(false);
      setError("Password is required.");
      return;
    }

    try {
      const payload = {
        name: form.name.trim() || null,
        username: form.username.trim() || null,
        email: form.email.trim() || null,
        mobile: form.mobile.trim() || null,
        password: form.password,
        role: form.role,
        is_active: form.is_active,
        permissions: extraPerms, // extra permissions only
      };

      const res = await api.post("/api/admin/users", payload);

      if (res.data?.success) router.push("/admin/users");
      else throw new Error(res.data?.message || "Failed to create user");
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGuard roles={["owner", "admin"]}>
      <div className="p-6 bg-gray-100 min-h-screen">
        <h1 className="text-3xl font-bold mb-6">Create User</h1>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow max-w-xl space-y-4">
          <div>
            <label className="block font-medium">Full Name</label>
            <input
              className="w-full p-2 border rounded mt-1"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Rahul Sharma"
            />
          </div>

          <div>
            <label className="block font-medium">Username (optional)</label>
            <input
              className="w-full p-2 border rounded mt-1"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="e.g. rahul"
            />
          </div>

          <div>
            <label className="block font-medium">Email (optional)</label>
            <input
              className="w-full p-2 border rounded mt-1"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="e.g. rahul@gmail.com"
            />
          </div>

          <div>
            <label className="block font-medium">Mobile (optional)</label>
            <input
              className="w-full p-2 border rounded mt-1"
              name="mobile"
              value={form.mobile}
              onChange={handleChange}
              placeholder="e.g. 9000000000"
            />
          </div>

          <div>
            <label className="block font-medium">Password</label>
            <input
              className="w-full p-2 border rounded mt-1"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block font-medium">Role</label>
            <select
              name="role"
              className="w-full p-2 border rounded mt-1"
              value={form.role}
              onChange={(e) => {
                setForm((p) => ({ ...p, role: e.target.value }));
                setExtraPerms([]); // optional: reset extras when role changes
              }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
            Active User
          </label>

          {/* Advanced permissions */}
          <div className="border rounded p-3">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} />
              Advanced: Extra Permissions (optional)
            </label>

            {showAdvanced && (
              <div className="mt-3 space-y-3">
                {/* Search + Buttons */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search permissions..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 p-2 border rounded"
                  />
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="px-3 py-2 bg-gray-800 text-white rounded text-sm"
                    title="Select all visible permissions (after search filter)"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="px-3 py-2 bg-gray-200 rounded text-sm"
                    title="Clear all selected permissions"
                  >
                    Clear
                  </button>
                </div>

                {/* Grouped Permissions */}
                <div className="max-h-80 overflow-auto space-y-4 border rounded p-2 bg-white">
                  {Object.entries(groupedPermissions).map(([group, perms]) => (
                    <div key={group}>
                    <div className="flex justify-between items-center border-b mb-2">
  <h4 className="font-semibold text-blue-700">{group}</h4>

  <div className="flex gap-2">
    <button
      type="button"
      onClick={() => {
        const keys = perms.map((p) => p.permission_key);
        setExtraPerms((prev) => Array.from(new Set([...prev, ...keys])).sort());
      }}
      className="px-2 py-1 bg-gray-800 text-white rounded text-xs"
    >
      Select group
    </button>

    <button
      type="button"
      onClick={() => {
        const keys = new Set(perms.map((p) => p.permission_key));
        setExtraPerms((prev) => prev.filter((k) => !keys.has(k)));
      }}
      className="px-2 py-1 bg-gray-200 rounded text-xs"
    >
      Clear group
    </button>
  </div>
</div>


                      {perms.map((p) => {
                        const key = p.permission_key;
                        const checked = extraPerms.includes(key);

                        return (
                          <label key={key} className="flex items-start gap-2 text-sm mb-1">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePerm(key)}
                              className="mt-1"
                            />
                            <div>
                              <div className="font-medium">{key}</div>
                              {p.description ? <div className="text-gray-600">{p.description}</div> : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ))}

                  {Object.keys(groupedPermissions).length === 0 && (
                    <div className="text-sm text-gray-600 p-2">No permissions match your search.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-600">{error}</p>}

          <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white p-3 rounded">
            {saving ? "Saving..." : "Create User"}
          </button>
        </form>
      </div>
    </AuthGuard>
  );
}

