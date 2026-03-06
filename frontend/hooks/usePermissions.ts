
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

type PermissionMap = Record<string, boolean>;

/**
 * ✅ Reads token from "showroom_token" (main)
 * ✅ Also supports old key "token" (backup compat)
 * ✅ Calls /api/admin/my-permissions (owner/admin) as per your backend
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const getToken = () => {
    if (typeof window === "undefined") return null;
    return (
      localStorage.getItem("showroom_token") || // ✅ correct key
      localStorage.getItem("token") // ✅ backward compatible
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

      // supports formats:
      // { success: true, permissions: {...} }
      // OR { permissions: {...} }
      const perms = res.data?.permissions;

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
    // Re-run when route changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    // If token is set after login, force reload permissions
    const onStorage = (e: StorageEvent) => {
      if (e.key === "showroom_token" || e.key === "token") {
        setLoading(true);
        loadPermissions();
      }
    };

    window.addEventListener("storage", onStorage);

    // Also trigger once after mount (for same-tab login)
    const token = getToken();
    if (token) {
      setLoading(true);
      loadPermissions();
    }

    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPermission = (key: string) => permissions[key] === true;

  return { permissions, hasPermission, loading };
}

export default usePermissions;

