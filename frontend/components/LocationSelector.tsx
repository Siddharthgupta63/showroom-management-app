"use client";

import React, { useMemo } from "react";
import { STATES_UTS, DISTRICTS_BY_STATE, TEHSILS_BY_DISTRICT } from "@/lib/locations";

export default function LocationSelector({
  state,
  district,
  tehsil,
  onChange,
}: {
  state: string;
  district: string;
  tehsil: string;
  onChange: (next: { state: string; district: string; tehsil: string }) => void;
}) {
  const districts = useMemo(() => DISTRICTS_BY_STATE[state] || [], [state]);
  const tehsils = useMemo(() => TEHSILS_BY_DISTRICT[district] || [], [district]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div>
        <label className="block text-sm text-gray-600 mb-1">State</label>
        <select
          className="w-full px-3 py-2 border rounded"
          value={state}
          onChange={(e) => onChange({ state: e.target.value, district: "", tehsil: "" })}
        >
          <option value="">Select State</option>
          {STATES_UTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">District</label>
        <select
          className="w-full px-3 py-2 border rounded"
          value={district}
          onChange={(e) => onChange({ state, district: e.target.value, tehsil: "" })}
          disabled={!state}
        >
          <option value="">{state ? "Select District" : "Select State first"}</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Tehsil</label>
        <select
          className="w-full px-3 py-2 border rounded"
          value={tehsil}
          onChange={(e) => onChange({ state, district, tehsil: e.target.value })}
          disabled={!district}
        >
          <option value="">{district ? "Select Tehsil" : "Select District first"}</option>
          {tehsils.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
