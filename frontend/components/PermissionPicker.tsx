"use client";

import React, { useMemo, useState } from "react";

type Perm = {
  permission_key: string;
  description?: string | null;
};

type Props = {
  permissions: Perm[];              // full catalog
  selected: string[];               // extra user_permissions (not role defaults)
  onChangeSelected: (next: string[]) => void;
  roleDefaultKeys?: Set<string>;    // role defaults that should be checked+locked
};

function categoryOf(key: string) {
  const k = (key || "").toLowerCase();

  // WhatsApp
  if (k.includes("whatsapp")) return "WhatsApp";

  // Insurance
  if (k.includes("insurance") || k.includes("renew")) return "Insurance";

  // Admin / Permissions
  if (k.includes("manage_") || k.includes("permission")) return "Admin";

  // Import / Export
  if (k.includes("import") || k.includes("export") || k.includes("excel") || k.includes("bulk")) {
    return "Import / Export";
  }

  return "Other";
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

export default function PermissionPicker({
  permissions,
  selected,
  onChangeSelected,
  roleDefaultKeys = new Set<string>(),
}: Props) {
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    Insurance: false,
    WhatsApp: false,
    Admin: false,
    "Import / Export": false,
    Other: false,
  });

  const normalizedQuery = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return permissions;
    return permissions.filter((p) => {
      const key = (p.permission_key || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();
      return key.includes(normalizedQuery) || desc.includes(normalizedQuery);
    });
  }, [permissions, normalizedQuery]);

  const groups = useMemo(() => {
    const map: Record<string, Perm[]> = {};
    for (const p of filtered) {
      const cat = categoryOf(p.permission_key);
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    }

    // stable group order
    const orderedCats = ["Insurance", "WhatsApp", "Admin", "Import / Export", "Other"];
    const out: { cat: string; items: Perm[] }[] = [];
    for (const cat of orderedCats) {
      if (map[cat]?.length) {
        out.push({
          cat,
          items: map[cat].slice().sort((a, b) => a.permission_key.localeCompare(b.permission_key)),
        });
      }
    }
    return out;
  }, [filtered]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const isChecked = (key: string) => roleDefaultKeys.has(key) || selectedSet.has(key);
  const isLocked = (key: string) => roleDefaultKeys.has(key);

  const toggleOne = (key: string) => {
    if (isLocked(key)) return;
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChangeSelected(Array.from(next).sort());
  };

  const allKeysVisible = useMemo(() => {
    return groups.flatMap((g) => g.items.map((p) => p.permission_key));
  }, [groups]);

  const clearAll = () => {
    // keep nothing (extras only), role defaults still checked via roleDefaultKeys
    onChangeSelected([]);
  };

  const selectAllVisible = () => {
    // add all visible keys EXCEPT locked role defaults (those are implicit)
    const keys = allKeysVisible.filter((k) => !roleDefaultKeys.has(k));
    onChangeSelected(uniq([...selected, ...keys]).sort());
  };

  const selectAllInGroup = (cat: string) => {
    const g = groups.find((x) => x.cat === cat);
    if (!g) return;
    const keys = g.items.map((p) => p.permission_key).filter((k) => !roleDefaultKeys.has(k));
    onChangeSelected(uniq([...selected, ...keys]).sort());
  };

  const clearGroup = (cat: string) => {
    const g = groups.find((x) => x.cat === cat);
    if (!g) return;
    const groupKeys = new Set(g.items.map((p) => p.permission_key));
    const next = selected.filter((k) => !groupKeys.has(k));
    onChangeSelected(next.sort());
  };

  const toggleCollapse = (cat: string) => {
    setCollapsed((p) => ({ ...p, [cat]: !p[cat] }));
  };

  return (
    <div className="border rounded p-3 bg-white">
      {/* Search + global actions */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search permissions (key or description)..."
            className="w-full border rounded p-2"
          />
          <button
            type="button"
            onClick={selectAllVisible}
            className="px-3 py-2 bg-gray-800 text-white rounded whitespace-nowrap"
            title="Select all permissions currently visible (after search filter)"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="px-3 py-2 bg-gray-200 rounded whitespace-nowrap"
            title="Clear all extra permissions (role defaults stay checked)"
          >
            Clear All
          </button>
        </div>

        <div className="text-sm text-gray-600">
          Checked includes <b>role defaults</b> (locked) + <b>extra permissions</b> (editable).
        </div>
      </div>

      {/* Groups */}
      <div className="mt-3 space-y-3">
        {groups.map(({ cat, items }) => (
          <div key={cat} className="border rounded">
            <div className="flex justify-between items-center px-3 py-2 bg-gray-50">
              <button
                type="button"
                onClick={() => toggleCollapse(cat)}
                className="font-semibold text-left"
              >
                {collapsed[cat] ? "▶" : "▼"} {cat}{" "}
                <span className="text-gray-500 font-normal">({items.length})</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => selectAllInGroup(cat)}
                  className="px-2 py-1 bg-gray-800 text-white rounded text-sm"
                >
                  Select group
                </button>
                <button
                  type="button"
                  onClick={() => clearGroup(cat)}
                  className="px-2 py-1 bg-gray-200 rounded text-sm"
                >
                  Clear group
                </button>
              </div>
            </div>

            {!collapsed[cat] && (
              <div className="p-3 space-y-2 max-h-80 overflow-auto">
                {items.map((p) => {
                  const key = p.permission_key;
                  const checked = isChecked(key);
                  const locked = isLocked(key);

                  return (
                    <label key={key} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={() => toggleOne(key)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">
                          {key}{" "}
                          {locked ? (
                            <span className="text-green-700 font-normal">(role default)</span>
                          ) : null}
                        </div>
                        {p.description ? (
                          <div className="text-gray-600">{p.description}</div>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {groups.length === 0 && (
          <div className="text-sm text-gray-600 p-3">
            No permissions match your search.
          </div>
        )}
      </div>
    </div>
  );
}
