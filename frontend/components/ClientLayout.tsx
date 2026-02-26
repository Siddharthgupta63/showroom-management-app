"use client";

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
  return (
    <AuthProvider>
      {/* 1) If user disabled/password expired/token stale => interceptor redirects */}
      {/* 2) Guardian pings backend so “disabled user” gets kicked even if idle */}
      <SessionGuardian />

      {/* 3) Idle auto logout after 6 minutes */}
      <IdleLogoutClient minutes={6} />

      {/* 4) popup messages (password expired/disabled/idle etc.) */}
      <PasswordPopup />

      {/* App UI */}
      <Sidebar />
      <main className="flex-1 bg-gray-100 min-h-screen">{children}</main>
    </AuthProvider>
  );
}
