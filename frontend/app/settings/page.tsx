"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load settings on page open
  useEffect(() => {
    async function loadSettings() {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          alert("You must log in as admin");
          return;
        }

        const res = await api.get("/admin/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });

        setSettings(res.data.data);
      } catch (err) {
        console.error(err);
        alert("Failed to load settings (Admin only)");
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    loadSettings();
  }, []);

  // Save settings
  async function saveSettings() {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");

      await api.post(
        "/admin/settings",
        {
          login_method: settings.login_method,
          otp_channel: settings.otp_channel,
          otp_expiry_min: settings.otp_expiry_min,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Settings saved successfully!");
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">🔐 Admin Login Settings</h2>

      {/* LOGIN METHOD */}
      <div className="mb-5">
        <label className="block mb-1 font-semibold">Login Method</label>
        <select
          value={settings.login_method}
          onChange={(e) =>
            setSettings({ ...settings, login_method: e.target.value })
          }
          className="border rounded p-2 w-full"
        >
          <option value="email_otp">Email OTP</option>
          <option value="mobile_otp">Mobile OTP (SMS)</option>
          <option value="password">Password Only</option>
          <option value="both">Both (OTP or Password)</option>
        </select>
      </div>

      {/* OTP CHANNEL */}
      <div className="mb-5">
        <label className="block mb-1 font-semibold">OTP Channel</label>
        <select
          value={settings.otp_channel}
          onChange={(e) =>
            setSettings({ ...settings, otp_channel: e.target.value })
          }
          className="border rounded p-2 w-full"
        >
          <option value="email">Email</option>
          <option value="mobile">Mobile (SMS)</option>
        </select>
      </div>

      {/* OTP EXPIRY */}
      <div className="mb-6">
        <label className="block mb-1 font-semibold">OTP Expiry (Minutes)</label>
        <input
          type="number"
          min={1}
          value={settings.otp_expiry_min}
          onChange={(e) =>
            setSettings({
              ...settings,
              otp_expiry_min: Number(e.target.value),
            })
          }
          className="border rounded p-2 w-full"
        />
      </div>

      {/* Save Button */}
      <button
        onClick={saveSettings}
        disabled={saving}
        className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
