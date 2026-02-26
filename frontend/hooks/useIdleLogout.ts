"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

function safeLogout(router: ReturnType<typeof useRouter>) {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } catch {}
  router.replace("/login");
}

export function useIdleLogout(minutes: number = 6) {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Don’t run idle timer on login page
    if (pathname === "/login") return;

    // Only run if logged-in token exists
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;

    const timeoutMs = Math.max(1, minutes) * 60 * 1000;

    const resetTimer = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);

      timerRef.current = window.setTimeout(() => {
        // idle timeout reached
        safeLogout(router);
      }, timeoutMs);
    };

    // events that count as “activity”
    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ] as const;

    events.forEach((evt) => window.addEventListener(evt, resetTimer, true));

    // start timer immediately
    resetTimer();

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((evt) =>
        window.removeEventListener(evt, resetTimer, true)
      );
    };
  }, [minutes, router, pathname]);
}
