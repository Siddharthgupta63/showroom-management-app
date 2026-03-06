
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthGuard({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");

    if (!token || !userRaw) {
      router.replace("/login");
      return;
    }

    if (roles && roles.length > 0) {
      try {
        const user = JSON.parse(userRaw);
        const role = String(user?.role || "").toLowerCase();
        const allowed = roles.map((r) => String(r).toLowerCase());

        if (!allowed.includes(role)) {
          router.replace("/dashboard");
        }
      } catch {
        router.replace("/login");
      }
    }
  }, [router, roles]);

  return <>{children}</>;
}

