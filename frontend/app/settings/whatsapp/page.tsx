"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import React, { Fragment } from "react";


type Settings = {
  enabled: boolean;
  consecutive_failures: number;
  disabled_reason: string | null;
};

export default function WhatsAppSettingsPage() {
  const { permissions, loading } = usePermissions();

  const canView = !!permissions.view_whatsapp_logs;
  const canEdit = !!permissions.manage_whatsapp_settings;

  const [s, setS] = useState<Settings>({
    enabled: true,
    consecutive_failures: 0,
    disabled_reason: null,
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const load = async () => {
    setMsg(null);
    const res = await api.get("/api/whatsapp/settings");

    // backend may return different wrappers
    const raw = res.data?.settings || res.data?.data || res.data;

    setS({
      enabled: !!raw.enabled,
      consecutive_failures: Number(raw.consecutive_failures || 0),
      disabled_reason: raw.disabled_reason || null,
    });
  };

  useEffect(() => {
    if (loading) return;
    if (!canView) return;

    load().catch((e: any) =>
      setMsg({
        type: "err",
        text: e?.response?.data?.message || e?.message || "Failed to load",
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const save = async () => {
    if (!canEdit) return alert("Permission denied");

    setSaving(true);
    setMsg(null);

    try {
      await api.put("/api/whatsapp/settings", {
        enabled: !!s.enabled, // ✅ boolean
        consecutive_failures: Number(s.consecutive_failures || 0),
        disabled_reason: s.enabled ? null : s.disabled_reason || "Disabled by admin",
      });

      setMsg({ type: "ok", text: "Saved ✅" });
      await load();
    } catch (e: any) {
      setMsg({
        type: "err",
        text: e?.response?.data?.message || e?.message || "Save failed",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetFails = async () => {
    if (!canEdit) return alert("Permission denied");

    setSaving(true);
    setMsg(null);

    try {
      await api.put("/api/whatsapp/settings", {
        enabled: true,
        consecutive_failures: 0,
        disabled_reason: null,
      });

      setMsg({ type: "ok", text: "Reset done ✅" });
      await load();
    } catch (e: any) {
      setMsg({
        type: "err",
        text: e?.response?.data?.message || e?.message || "Reset failed",
      });
    } finally {
      setSaving(false);
    }
  };

  // Optional: mock test send (only works if your backend has /api/whatsapp/test-send)
  const testSend = async () => {
    if (!canEdit) return alert("Permission denied");
    try {
      const phone = prompt("Enter phone (10 digits):", "9876543210");
      if (!phone) return;

      const message = prompt("Enter message:", "Test message from DMS");
      if (!message) return;

      await api.post("/api/whatsapp/test-send", { phone, message });
      alert("Test send triggered ✅ Check WhatsApp Logs.");
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Test send failed");
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!canView) return <div style={{ padding: 20 }}>Permission denied</div>;

  return (
    <div style={{ padding: 16, maxWidth: 950 }}>
      <div style={card}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>⚙️ WhatsApp Settings</h2>
            <div style={{ color: "#6b7280", marginTop: 6, fontWeight: 700 }}>
              Enable/Disable WhatsApp and manage failure counter.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {/* Optional button - enable only if endpoint exists */}
            <button
              style={btnOutline}
              onClick={testSend}
              disabled={saving || !canEdit}
              title="Sends a test message using current provider"
            >
              Test Send
            </button>

            <button
              style={btnOutline}
              onClick={resetFails}
              disabled={saving || !canEdit}
            >
              Reset Fail Counter
            </button>

            <button
              style={btnPrimary}
              onClick={save}
              disabled={saving || !canEdit}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* Message */}
        {msg ? (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              fontWeight: 900,
              background: msg.type === "ok" ? "#dcfce7" : "#fee2e2",
              color: msg.type === "ok" ? "#166534" : "#991b1b",
            }}
          >
            {msg.text}
          </div>
        ) : null}

        {/* Cards */}
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          <div style={box}>
            <div style={label}>WhatsApp Enabled</div>

            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                style={s.enabled ? chipOn : chipOff}
                onClick={() => setS((p) => ({ ...p, enabled: true }))}
                disabled={!canEdit}
              >
                Enabled
              </button>

              <button
                style={!s.enabled ? chipOnRed : chipOff}
                onClick={() =>
                  setS((p) => ({
                    ...p,
                    enabled: false,
                    disabled_reason: p.disabled_reason || "Disabled by admin",
                  }))
                }
                disabled={!canEdit}
              >
                Disabled
              </button>

              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 900 }}>
                Current:{" "}
                {s.enabled ? (
                  <span style={{ color: "#166534" }}>Enabled</span>
                ) : (
                  <span style={{ color: "#991b1b" }}>Disabled</span>
                )}
              </span>
            </div>

            {!s.enabled ? (
              <div style={{ marginTop: 14 }}>
                <div style={label}>Disabled Reason</div>
                <input
                  style={input}
                  value={s.disabled_reason || ""}
                  onChange={(e) =>
                    setS((p) => ({ ...p, disabled_reason: e.target.value }))
                  }
                  disabled={!canEdit}
                  placeholder="Example: Token expired / Manual maintenance"
                />
              </div>
            ) : null}
          </div>

          <div style={box}>
            <div style={label}>Consecutive Failures</div>
            <div style={{ fontSize: 28, fontWeight: 950, marginTop: 6 }}>
              {s.consecutive_failures}
            </div>

            <div style={{ marginTop: 12, color: "#6b7280", fontWeight: 800 }}>
              Tip: If WhatsApp gets auto-disabled, reset failures after fixing
              token/provider.
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px dashed #e5e7eb",
            color: "#6b7280",
            fontWeight: 800,
          }}
        >
          When you get real WhatsApp credentials, just change backend{" "}
          <b>WHATSAPP_PROVIDER=cloudapi</b> and set token/phone id.
        </div>
      </div>
    </div>
  );
}

/* styles */
const card: any = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 14,
  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
};

const box: any = {
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
};

const label: any = { fontSize: 12, color: "#6b7280", fontWeight: 900 };

const input: any = {
  height: 40,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  outline: "none",
  fontSize: 14,
  width: "100%",
  marginTop: 8,
};

const btnOutline: any = {
  height: 38,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};

const btnPrimary: any = {
  height: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};

const chipOff: any = {
  height: 34,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const chipOn: any = {
  ...chipOff,
  background: "#dcfce7",
  border: "1px solid #86efac",
  color: "#166534",
};

const chipOnRed: any = {
  ...chipOff,
  background: "#fee2e2",
  border: "1px solid #fecaca",
  color: "#991b1b",
};
