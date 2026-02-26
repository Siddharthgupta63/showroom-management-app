"use client";

import { useEffect, useState } from "react";

export default function PasswordPopup() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    try {
      const m = localStorage.getItem("auth_popup_message") || "";
      if (m) {
        setMsg(m);
        setOpen(true);
        // one-time
        localStorage.removeItem("auth_popup_message");
      }
    } catch {}
  }, []);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: 520,
          maxWidth: "90vw",
          background: "#fff",
          borderRadius: 12,
          padding: 18,
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Session Notice
        </div>
        <div style={{ fontSize: 14, color: "#333", marginBottom: 14 }}>
          {msg}
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: "#111827",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 8,
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
