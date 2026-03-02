"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { AuthProvider } from "@/providers/AuthProvider";
import Sidebar from "@/components/Sidebar";
import SessionGuardian from "@/components/SessionGuardian";
import IdleLogoutClient from "@/components/IdleLogoutClient";
import PasswordPopup from "@/components/PasswordPopup";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Pages where sidebar/layout should NOT appear
  const noShell =
    pathname === "/login" ||
    pathname === "/" ||
    pathname === "/_not-found";

  return (
    <AuthProvider>
      {/* Keep these global guards active */}
      <SessionGuardian />
      <IdleLogoutClient minutes={6} />
      <PasswordPopup />

      {noShell ? (
        // Login (and root redirect) should be clean (no sidebar)
        <main className="min-h-screen bg-gray-100">{children}</main>
      ) : (
        // App UI layout
        <>
          <Sidebar />
          <main className="flex-1 bg-gray-100 min-h-screen">{children}</main>
        </>
      )}
    </AuthProvider>
  );
}
