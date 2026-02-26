
"use client";

import { useEffect, useRef } from "react";

export default function IdleLogoutClient({ minutes = 6 }: { minutes?: number }) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const ms = minutes * 60 * 1000;

    const logout = () => {
      try {
        localStorage.removeItem("token");
        localStorage.setItem("auth_popup_reason", "idle");
        localStorage.setItem(
          "auth_popup_message",
          `Logged out due to inactivity (${minutes} minutes).`
        );
      } catch {}
      window.location.href = "/login?reason=idle";
    };

    const reset = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(logout, ms);
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ] as const;

    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) =>
        window.removeEventListener(e, reset as any, { passive: true } as any)
      );
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [minutes]);

  return null;
}

