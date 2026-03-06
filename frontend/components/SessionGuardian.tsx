"use client";

import { useEffect } from "react";
import api from "@/lib/api";

export default function SessionGuardian() {
  useEffect(() => {
    let stopped = false;

    const ping = async () => {
      const token = localStorage.getItem("token") || localStorage.getItem("showroom_token");
      if (!token) return;

      try {
        await api.get("/api/auth/me");
        // optional:
        // await api.post("/api/auth/heartbeat");
      } catch {
        // api interceptor handles redirect
      }
    };

    ping();
    const id = window.setInterval(() => {
      if (!stopped) ping();
    }, 30_000);

    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, []);

  return null;
}
