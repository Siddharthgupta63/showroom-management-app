"use client";

import { useEffect, useState } from "react";
import DASHBOARD_METRICS from "@/constants/dashboardMetrics";
import ROLES from "@/constants/roles";

export default function DashboardPermissions() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/admin/dashboard-permissions", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    })
      .then(res => res.json())
      .then(setData);
  }, []);

  const toggle = (role: string, metric: string) => {
    setData(prev =>
      prev.map(p =>
        p.role === role && p.metric_key === metric
          ? { ...p, allowed: !p.allowed }
          : p
      )
    );
  };

  const save = async () => {
    await fetch("/api/admin/dashboard-permissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({ permissions: data })
    });
    alert("Saved");
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Dashboard Permissions</h1>

      <table className="border w-full">
        <thead>
          <tr>
            <th>Role</th>
            {DASHBOARD_METRICS.map(m => (
              <th key={m.key}>{m.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {ROLES.map(role => (
            <tr key={role}>
              <td>{role}</td>
              {DASHBOARD_METRICS.map(metric => {
                const row = data.find(
                  d => d.role === role && d.metric_key === metric.key
                );
                return (
                  <td key={metric.key}>
                    <input
                      type="checkbox"
                      checked={row?.allowed || false}
                      onChange={() => toggle(role, metric.key)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={save}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Save Changes
      </button>
    </div>
  );
}
