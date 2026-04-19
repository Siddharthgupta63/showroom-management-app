"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type MenuItem = {
  label: string;
  href: string;
  icon: string;
};

type MenuSection = {
  section: string;
  items: MenuItem[];
};

const menu: MenuSection[] = [
  {
    section: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
      { label: "Pipeline", href: "/pipeline", icon: "pipeline" },
      { label: "Sales", href: "/sales", icon: "sales" },
      { label: "Contacts", href: "/contacts", icon: "contacts" },
      { label: "Vehicles", href: "/vehicles", icon: "vehicles" },
      { label: "Purchases", href: "/purchases", icon: "purchases" },
      { label: "Stock", href: "/stock", icon: "stock" },
      { label: "Stock Transfers", href: "/stock/transfers", icon: "transfer" },
      { label: "Insurance", href: "/insurance", icon: "insurance" },
      { label: "VAHAN", href: "/vahan", icon: "file" },
      { label: "WhatsApp Logs", href: "/whatsapp-logs", icon: "chat" },
    ],
  },
  {
    section: "Admin",
    items: [
      { label: "Users", href: "/admin/users", icon: "users" },
      { label: "Active Users", href: "/admin/active-users", icon: "activeUsers" },
      { label: "Staff Access Time", href: "/admin/access-window", icon: "clock" },
      { label: "Dashboard Permissions", href: "/admin/dashboard-permissions", icon: "shield" },
      { label: "Permissions", href: "/admin/permissions", icon: "key" },
      { label: "Dropdowns", href: "/admin/dropdowns", icon: "list" },
    ],
  },
  {
    section: "Reports",
    items: [
      { label: "Reports Dashboard", href: "/reports", icon: "chartBoard" },
      { label: "Sales Report", href: "/reports/sales", icon: "chart" },
      { label: "Stock Report", href: "/reports/stock", icon: "chart" },
      { label: "Stock Ageing", href: "/reports/stock-ageing", icon: "chart" },
      { label: "ODRC Report", href: "/reports/odrc", icon: "chart" },
      { label: "Purchase vs Sales", href: "/reports/purchase-vs-sales", icon: "chart" },
    ],
  },
];

function SidebarIcon({ name, active = false }: { name: string; active?: boolean }) {
  const stroke = active ? "#dc2626" : "currentColor";

  const common = {
    className: "h-[17px] w-[17px]",
    fill: "none",
    stroke,
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="4" rx="1.5" />
          <rect x="14" y="10" width="7" height="11" rx="1.5" />
          <rect x="3" y="13" width="7" height="8" rx="1.5" />
        </svg>
      );
    case "pipeline":
      return (
        <svg {...common}>
          <path d="M4 17l5-5 4 4 7-9" />
          <path d="M20 10V4h-6" />
        </svg>
      );
    case "sales":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M7 4h10" />
          <rect x="4" y="7" width="16" height="13" rx="2" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </svg>
      );
    case "contacts":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="9.5" cy="7" r="3.5" />
          <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 4.13a3.5 3.5 0 0 1 0 5.74" />
        </svg>
      );
    case "vehicles":
      return (
        <svg {...common}>
          <path d="M5 16l1.5-5h11L19 16" />
          <rect x="3" y="10" width="18" height="7" rx="2" />
          <circle cx="7" cy="17" r="1.5" />
          <circle cx="17" cy="17" r="1.5" />
        </svg>
      );
    case "purchases":
      return (
        <svg {...common}>
          <path d="M6 7l6-4 6 4" />
          <path d="M6 7v10l6 4 6-4V7" />
          <path d="M6 7l6 4 6-4" />
          <path d="M12 11v10" />
        </svg>
      );
    case "stock":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 9h8" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
      );
    case "transfer":
      return (
        <svg {...common}>
          <path d="M7 7h11" />
          <path d="M14 4l4 3-4 3" />
          <path d="M17 17H6" />
          <path d="M10 14l-4 3 4 3" />
        </svg>
      );
    case "insurance":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
          <path d="M9.5 12l1.5 1.5 3.5-3.5" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h6" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.7 8.7 0 0 1-3-.5L3 21l1.5-5A8.5 8.5 0 1 1 21 11.5z" />
          <path d="M8.5 11.5h.01" />
          <path d="M12 11.5h.01" />
          <path d="M15.5 11.5h.01" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M4 19a5 5 0 0 1 10 0" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M15 19a4 4 0 0 1 6 0" />
        </svg>
      );
    case "activeUsers":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M4 19a5 5 0 0 1 10 0" />
          <path d="M16 10l2 2 4-4" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <circle cx="8" cy="15" r="3" />
          <path d="M11 15h10" />
          <path d="M18 12v6" />
          <path d="M21 13v4" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path d="M9 6h11" />
          <path d="M9 12h11" />
          <path d="M9 18h11" />
          <circle cx="4" cy="6" r="1" fill={stroke} />
          <circle cx="4" cy="12" r="1" fill={stroke} />
          <circle cx="4" cy="18" r="1" fill={stroke} />
        </svg>
      );
    case "chartBoard":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M10 19V9" />
          <path d="M16 19v-6" />
          <path d="M22 19V7" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M22 20V8" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);

    try {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved === "1") setCollapsed(true);
    } catch {}

    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

   useEffect(() => {
    if (!mounted) return;

    try {
      const width =
        typeof window !== "undefined" && window.innerWidth < 1024
          ? "0px"
          : collapsed
          ? "72px"
          : "250px";

      localStorage.setItem("sidebar_collapsed", collapsed ? "1" : "0");
      document.documentElement.style.setProperty("--sidebar-width", width);
    } catch {}
  }, [collapsed, mounted]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href;

  const logout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("showroom_token");
    } catch {}
    window.location.href = "/login";
  };

  const desktopWidthClass = useMemo(() => {
    return collapsed ? "w-[72px]" : "w-[250px]";
  }, [collapsed]);

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-[70] rounded-xl bg-red-600 text-white px-3 py-2 shadow-lg"
      >
        ☰
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-[60]"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={[
          "fixed top-0 left-0 z-[80] h-screen bg-red-600 text-white flex flex-col border-r border-red-500 transition-all duration-300 ease-out shadow-xl",
          desktopWidthClass,
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        ].join(" ")}
      >
        <div className="relative flex items-center gap-3 px-4 py-4 border-b border-red-500 min-h-[82px]">
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <h1 className="text-[18px] font-extrabold leading-tight truncate">
                GUPTA AUTO AGENCY
              </h1>
              <p className="text-sm text-red-100 truncate">Hero MotoCorp</p>
            </div>
          ) : (
            <div className="mx-auto h-9 w-9 rounded-2xl bg-white/12 border border-white/20 flex items-center justify-center text-sm font-bold">
              G
            </div>
          )}

          {!collapsed ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-xl bg-red-500 hover:bg-red-400 border border-red-300/40 transition"
                title="Collapse Sidebar"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-xl bg-red-500 hover:bg-red-400 border border-red-300/40 transition"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="hidden lg:inline-flex absolute top-4 left-1/2 -translate-x-1/2 h-8 w-8 items-center justify-center rounded-xl bg-red-500 hover:bg-red-400 border border-red-300/40 transition"
              title="Expand Sidebar"
            >
              »
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          {menu.map((section) => (
            <div key={section.section} className="mb-4">
              {!collapsed ? (
                <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-100/90">
                  {section.section}
                </div>
              ) : (
                <div className="mx-auto mb-2 h-px w-7 bg-white/25" />
              )}

              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item.href);

                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        title={collapsed ? item.label : ""}
                        className={[
                          "group relative flex items-center rounded-2xl transition-all duration-200 cursor-pointer",
                          collapsed ? "justify-center px-0 py-1.5" : "gap-3 px-3 py-2",
                          active
                            ? "bg-white text-red-600 shadow-sm"
                            : "text-white hover:bg-red-500/90",
                        ].join(" ")}
                      >
                        <div
                          className={[
                            "flex items-center justify-center shrink-0 rounded-xl transition-all",
                            collapsed ? "h-9 w-9" : "h-8 w-8",
                            active
                              ? "bg-red-50 text-red-600"
                              : "bg-white/10 text-white group-hover:bg-white/16",
                          ].join(" ")}
                        >
                          <SidebarIcon name={item.icon} active={active} />
                        </div>

                        {!collapsed && (
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-semibold">
                              {item.label}
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-red-500">
          <button
            type="button"
            onClick={logout}
            title={collapsed ? "Logout" : ""}
            className={[
              "w-full rounded-2xl bg-white text-red-600 font-semibold hover:bg-red-50 transition shadow-sm",
              collapsed ? "h-10 px-0" : "px-4 py-2 text-sm",
            ].join(" ")}
          >
            {collapsed ? "↩" : "Logout"}
          </button>
        </div>
      </aside>
    </>
  );
}