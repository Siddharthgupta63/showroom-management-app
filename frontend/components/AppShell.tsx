"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

const EXPANDED_WIDTH = 250;
const COLLAPSED_WIDTH = 72;

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarWidth, setSidebarWidth] = useState(EXPANDED_WIDTH);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const syncSidebarWidth = () => {
      try {
        if (window.innerWidth < 1024) {
          setSidebarWidth(0);
          return;
        }

        const saved = localStorage.getItem("sidebar_collapsed");
        setSidebarWidth(saved === "1" ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
      } catch {
        setSidebarWidth(EXPANDED_WIDTH);
      }
    };

    syncSidebarWidth();

    window.addEventListener("resize", syncSidebarWidth);
    window.addEventListener("sidebar-width-change", syncSidebarWidth);

    return () => {
      window.removeEventListener("resize", syncSidebarWidth);
      window.removeEventListener("sidebar-width-change", syncSidebarWidth);
    };
  }, []);

  const hideSidebar =
    pathname === "/login" ||
    pathname === "/" ||
    pathname.startsWith("/sales/") ||
    pathname.startsWith("/purchases/print") ||
    pathname.startsWith("/sales/print");

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <main
        className="min-h-screen transition-all duration-300 ease-out"
        style={{
          marginLeft: mounted ? `${sidebarWidth}px` : `${EXPANDED_WIDTH}px`,
          width: mounted ? `calc(100% - ${sidebarWidth}px)` : `calc(100% - ${EXPANDED_WIDTH}px)`,
        }}
      >
        {children}
      </main>
    </div>
  );
}