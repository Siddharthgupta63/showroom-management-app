"use client";

import React from "react";
import { useAuthContext } from "@/providers/AuthProvider";
import { useSidebar } from "@/hooks/useSidebar";

export default function Header() {
  const { user, logout } = useAuthContext();
  const { toggle } = useSidebar();

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white shadow z-40 flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-3">
        {/* Mobile sidebar toggle */}
        <button
          onClick={toggle}
          className="md:hidden p-2 rounded hover:bg-gray-100"
          aria-label="Toggle menu"
        >
          ☰
        </button>

        <span className="text-lg font-semibold">Showroom DMS</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="hidden sm:block text-sm text-gray-700">
          {user?.email || "User"}
        </span>

        <button
          onClick={logout}
          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
