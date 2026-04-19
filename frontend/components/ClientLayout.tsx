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
        <main className="min-h-screen bg-background text-foreground">
          {children}
        </main>
      ) : (
        <div className="min-h-screen bg-background text-foreground">
          <Sidebar />

          <main
            className="min-h-screen transition-all duration-300 ease-out"
            style={{
              marginLeft: "var(--sidebar-width, 250px)",
              width: "calc(100% - var(--sidebar-width, 250px))",
            }}
          >
            <div className="px-4 py-4 lg:px-6">{children}</div>
          </main>
        </div>
      )}
    </AuthProvider>
  );
}