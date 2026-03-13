"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DASHBOARD_METRICS from "@/constants/dashboardMetrics";
import ROLES from "@/constants/roles";
import api from "@/lib/api";

type Row = {
  role: string;
  metric_key: string;
  allowed: boolean;
};

export default function DashboardPermissions() {
  const router = useRouter();

  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState("");

  const getToken = () =>
    localStorage.getItem("showroom_token") || localStorage.getItem("token");

  useEffect(() => {
    const token = getToken();

    if (!token) {
      setAuthError("Session expired. Please login again.");
      setLoading(false);
      return;
    }

    api
      .get("/api/admin/dashboard-permissions")
      .then((res) => {
        const rows = Array.isArray(res.data?.data)
          ? res.data.data.map((r: any) => ({
              role: String(r.role),
              metric_key: String(r.metric_key),
              allowed: Number(r.is_visible || 0) === 1,
            }))
          : [];
        setData(rows);
        setAuthError("");
      })
      .catch((err) => {
        const status = err?.response?.status;

        if (status === 401) {
          setAuthError("Session expired. Please login again.");
          localStorage.removeItem("token");
          localStorage.removeItem("showroom_token");
        } else if (status === 403) {
          setAuthError("Only owner can access dashboard permissions.");
        } else {
          setAuthError("Failed to load dashboard permissions.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = (role: string, metric: string) => {
    setData((prev) => {
      const idx = prev.findIndex(
        (p) => p.role === role && p.metric_key === metric
      );

      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], allowed: !copy[idx].allowed };
        return copy;
      }

      return [...prev, { role, metric_key: metric, allowed: true }];
    });
  };

  const isChecked = (role: string, metric: string) => {
    const row = data.find(
      (d) => d.role === role && d.metric_key === metric
    );
    return !!row?.allowed;
  };

  const roleCounts = ROLES.reduce<Record<string, number>>((acc, role) => {
    acc[role] = DASHBOARD_METRICS.filter((m) => isChecked(role, m.key)).length;
    return acc;
  }, {});

  const setAllForRole = (role: string, allowed: boolean) => {
    setData((prev) => {
      const map = new Map(prev.map((p) => [`${p.role}__${p.metric_key}`, p]));
      for (const metric of DASHBOARD_METRICS) {
        const key = `${role}__${metric.key}`;
        const existing = map.get(key);
        map.set(
          key,
          existing
            ? { ...existing, allowed }
            : { role, metric_key: metric.key, allowed }
        );
      }
      return Array.from(map.values());
    });
  };

  const setAllForMetric = (metricKey: string, allowed: boolean) => {
    setData((prev) => {
      const map = new Map(prev.map((p) => [`${p.role}__${p.metric_key}`, p]));
      for (const role of ROLES) {
        const key = `${role}__${metricKey}`;
        const existing = map.get(key);
        map.set(
          key,
          existing
            ? { ...existing, allowed }
            : { role, metric_key: metricKey, allowed }
        );
      }
      return Array.from(map.values());
    });
  };

  const save = async () => {
    try {
      setSaving(true);
      setAuthError("");

      const res = await api.post("/api/admin/dashboard-permissions", {
        permissions: data.map((p) => ({
          role: p.role,
          metric_key: p.metric_key,
          is_visible: p.allowed,
        })),
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Save failed");
      }

      alert("Saved");
    } catch (err: any) {
      const status = err?.response?.status;

      if (status === 401) {
        setAuthError("Session expired. Please login again.");
        localStorage.removeItem("token");
        localStorage.removeItem("showroom_token");
      } else if (status === 403) {
        setAuthError("Only owner can update dashboard permissions.");
      } else {
        alert(err?.response?.data?.message || err?.message || "Save failed");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-3xl mx-auto bg-white border border-red-200 rounded-2xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Dashboard Permissions
          </h1>
          <p className="text-gray-700">{authError}</p>
          <div className="mt-4">
            <button
              onClick={() => router.push("/login")}
              className="px-4 py-2 bg-red-600 text-white rounded-xl"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-[1500px] mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Dashboard Permissions
              </h1>
              <p className="text-xs text-gray-600 mt-1">
                Choose which dashboard cards each role can see.
              </p>
            </div>

            <button
              onClick={save}
              disabled={saving || loading}
              className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-3 font-semibold text-gray-900 min-w-[150px] border-b border-r">
                    Role
                  </th>

                  {DASHBOARD_METRICS.map((metric) => (
                    <th
                      key={metric.key}
                      className="px-2 py-3 text-center min-w-[145px] border-b border-r last:border-r-0"
                    >
                      <div className="text-[13px] font-semibold text-gray-900 leading-tight">
                        {metric.label}
                      </div>
                      <div className="flex items-center justify-center gap-1 mt-2">
                        <button
                          onClick={() => setAllForMetric(metric.key, true)}
                          className="px-2 py-0.5 text-[11px] rounded-md bg-green-100 text-green-700 font-semibold"
                        >
                          All
                        </button>
                        <button
                          onClick={() => setAllForMetric(metric.key, false)}
                          className="px-2 py-0.5 text-[11px] rounded-md bg-gray-100 text-gray-700 font-semibold"
                        >
                          None
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {ROLES.map((role, rowIndex) => (
                  <tr
                    key={role}
                    className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                  >
                    <td className="px-3 py-3 border-r border-b align-middle">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-900 capitalize leading-tight">
                            {role}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-1">
                            {roleCounts[role] || 0} enabled
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={() => setAllForRole(role, true)}
                            className="px-2 py-0.5 text-[11px] rounded-md bg-green-100 text-green-700 font-semibold"
                          >
                            All
                          </button>
                          <button
                            onClick={() => setAllForRole(role, false)}
                            className="px-2 py-0.5 text-[11px] rounded-md bg-gray-100 text-gray-700 font-semibold"
                          >
                            None
                          </button>
                        </div>
                      </div>
                    </td>

                    {DASHBOARD_METRICS.map((metric) => {
                      const checked = isChecked(role, metric.key);

                      return (
                        <td
                          key={metric.key}
                          className="px-2 py-3 text-center border-r border-b last:border-r-0"
                        >
                          <button
                            type="button"
                            onClick={() => toggle(role, metric.key)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                              checked
                                ? "bg-red-600 border-red-600 text-white"
                                : "bg-white border-gray-300 text-gray-400 hover:border-red-400"
                            }`}
                          >
                            <svg
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-4 w-4"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.704 5.29a1 1 0 010 1.42l-7.2 7.2a1 1 0 01-1.415 0l-3-3a1 1 0 111.415-1.42l2.292 2.294 6.493-6.494a1 1 0 011.415 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Changes apply after saving.
          </div>
        </div>
      </div>
    </div>
  );
}