"use client";

import React, { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);

  const [loginMethod, setLoginMethod] = useState("");
  const [otpExpiry, setOtpExpiry] = useState(5);
  const [otpChannel, setOtpChannel] = useState("sms");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Load settings from backend
  useEffect(() => {
    async function load() {
      try {
        const res1 = await api.get("/settings/login-method");
        const res2 = await api.get("/settings/otp-config");

        setLoginMethod(res1.data?.login_method || "mobile_otp");

        setOtpExpiry(res2.data?.expiry || 5);
        setOtpChannel(res2.data?.channel || "sms");
      } catch (err) {
        console.error("Settings load error", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Save settings
  async function saveSettings() {
    setSaving(true);
    setMessage(null);

    try {
      await api.put("/settings/login-method", {
        login_method: loginMethod,
      });

      await api.put("/settings/otp-config", {
        expiry: otpExpiry,
        channel: otpChannel,
      });

      setMessage("Settings saved successfully!");
    } catch (err: any) {
      setMessage(err?.response?.data?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGuard roles={["owner", "manager"]}>
      <div className="p-6 min-h-screen bg-gray-100">
        
        <h1 className="text-3xl font-bold mb-6">Admin Settings</h1>

        {loading && <p>Loading settings...</p>}

        {!loading && (
          <div className="bg-white p-6 rounded shadow max-w-xl">

            {/* LOGIN METHOD */}
            <label className="block mb-4">
              <div className="font-semibold mb-1">Login Method</div>
              <select
                value={loginMethod}
                onChange={(e) => setLoginMethod(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="email_otp">Email OTP</option>
                <option value="mobile_otp">Mobile OTP</option>
                <option value="password">Password</option>
                <option value="both">Both (OTP + Password)</option>
              </select>
            </label>

            {/* OTP CHANNEL */}
            <label className="block mb-4">
              <div className="font-semibold mb-1">OTP Channel</div>
              <select
                value={otpChannel}
                onChange={(e) => setOtpChannel(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="both">Both</option>
              </select>
            </label>

            {/* OTP EXPIRY */}
            <label className="block mb-4">
              <div className="font-semibold mb-1">OTP Expiry (Minutes)</div>
              <input
                type="number"
                value={otpExpiry}
                onChange={(e) => setOtpExpiry(Number(e.target.value))}
                className="w-full p-2 border rounded"
                min={1}
                max={30}
              />
            </label>

            {/* SAVE BUTTON */}
            <button
              className="w-full bg-blue-600 text-white p-3 rounded mt-4"
              disabled={saving}
              onClick={saveSettings}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>

            {/* MESSAGE */}
            {message && (
              <p className="mt-4 text-center text-green-700 font-semibold">
                {message}
              </p>
            )}

          </div>
        )}

      </div>
    </AuthGuard>
  );
}
