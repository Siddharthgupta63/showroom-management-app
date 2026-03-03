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

  const noShell =
    pathname === "/login" ||
    pathname === "/" ||
    pathname === "/_not-found";

  return (
    <AuthProvider>
      <SessionGuardian />
      <IdleLogoutClient minutes={6} />
      <PasswordPopup />

      {noShell ? (
        <main className="min-h-screen bg-gray-100">
          {children}
        </main>
      ) : (
        <div className="min-h-screen bg-gray-100">
          {/* Desktop sidebar (fixed width 64) */}
          <div className="hidden lg:block fixed left-0 top-0 h-screen w-64">
            <Sidebar />
          </div>

          {/* Main content pushed right on desktop */}
          <main className="min-h-screen lg:ml-64">
            <div className="px-4 py-4 lg:px-6">
              {children}
            </div>
          </main>
        </div>
      )}
    </AuthProvider>
  );
}