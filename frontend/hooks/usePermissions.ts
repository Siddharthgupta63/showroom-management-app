"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

type PermissionMap = Record<string, any>;

export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const getToken = () => {
    if (typeof window === "undefined") return null;
    return (
      localStorage.getItem("showroom_token") ||
      localStorage.getItem("token")
    );
  };

  const loadPermissions = async () => {
    try {
      const token = getToken();
      if (!token) {
        setPermissions({});
        return;
      }

      const res = await api.get("/api/admin/my-permissions");
      const perms = res.data?.permissions;

      console.log("my-permissions API response:", res.data);

      if (perms && typeof perms === "object") {
        setPermissions(perms);
      } else {
        setPermissions({});
      }
    } catch (err) {
      console.error("Permission fetch failed:", err);
      setPermissions({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "showroom_token" || e.key === "token") {
        setLoading(true);
        loadPermissions();
      }
    };

    window.addEventListener("storage", onStorage);

    const token = getToken();
    if (token) {
      setLoading(true);
      loadPermissions();
    }

    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPermission = (key: string) => {
    const value = permissions[key];
    return (
      value === true ||
      value === 1 ||
      value === "1" ||
      value === "true"
    );
  };

  return { permissions, hasPermission, loading };
}

export default usePermissions;