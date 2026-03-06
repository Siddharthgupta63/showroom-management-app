"use client";

import React from "react";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // routes where sidebar/header should NOT appear
  const noShell =
    pathname === "/login" ||
    pathname === "/" || // since / redirects to /login or /dashboard
    pathname.startsWith("/_not-found");

  if (noShell) return <>{children}</>;

  return <>{children}</>;
}
