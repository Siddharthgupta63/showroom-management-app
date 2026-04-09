"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { getUser } from "@/lib/auth";

export default function Sidebar() {
  const { hasPermission, loading } = usePermissions();
  const pathname = usePathname();

  const user = getUser();
  const role = String(user?.role || "").toLowerCase();
  const isOwnerAdmin = role === "owner" || role === "admin";
  const isOwnerAdminManager = isOwnerAdmin || role === "manager";

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("showroom_token");
    window.location.href = "/login";
  };

  if (loading) return null;

  const isActive = (href: string) => {
    if (pathname === href) return true;
    return pathname.startsWith(href + "/");
  };

  const linkClass = (href: string) =>
    `block px-3 py-2 rounded hover:bg-red-500 ${
      isActive(href) ? "bg-red-500" : ""
    }`;

  const childLinkClass = (href: string) =>
    `block px-3 py-2 rounded hover:bg-red-500/80 ${
      isActive(href) ? "bg-red-500/80" : ""
    }`;

  const canInsurance = isOwnerAdmin || hasPermission("add_insurance");
  const canWhatsappLogs = isOwnerAdmin || hasPermission("view_whatsapp_logs");
  const canWhatsappSettings =
    isOwnerAdmin || hasPermission("manage_whatsapp_settings");

  const canPurchases =
    isOwnerAdmin ||
    hasPermission("view_purchases") ||
    hasPermission("manage_purchases");

  const canStock =
    isOwnerAdmin ||
    hasPermission("view_purchases") ||
    hasPermission("manage_purchases");

  const canVahan = isOwnerAdmin || hasPermission("vahan_access");

  const canPermissions =
    isOwnerAdminManager || hasPermission("manage_permissions");
  const canDropdowns =
    isOwnerAdminManager || hasPermission("manage_dropdowns");

  const canDashboardPermissions = isOwnerAdmin;

  const canAdminSection =
    isOwnerAdminManager ||
    canPermissions ||
    canDropdowns ||
    canDashboardPermissions;

  // Reports access
  const canReports =
    isOwnerAdminManager ||
    hasPermission("view_reports") ||
    hasPermission("export_reports");

  const isReportsSectionActive =
    isActive("/reports") ||
    isActive("/reports/sales") ||
    isActive("/reports/stock");

  const reportsParentClass = `block px-3 py-2 rounded hover:bg-red-500 ${
    isReportsSectionActive ? "bg-red-500" : ""
  }`;

  const isAdminUsersSectionActive =
    isActive("/admin/users") ||
    isActive("/admin/active-users") ||
    isActive("/admin/access-window") ||
    isActive("/admin/dashboard-permissions") ||
    isActive("/admin/permissions") ||
    isActive("/admin/dropdowns");

  const usersParentClass = `block px-3 py-2 rounded hover:bg-red-500 ${
    isAdminUsersSectionActive ? "bg-red-500" : ""
  }`;

  return (
    <aside className="w-64 bg-red-600 text-white h-screen flex flex-col">
      <div className="p-4 border-b border-red-500">
        <h1 className="text-xl font-bold">GUPTA AUTO AGENCY</h1>
        <p className="text-sm opacity-90">Hero MotoCorp</p>
      </div>

      <nav className="flex-1 min-h-0 p-4 space-y-2 overflow-y-auto">
        <Link href="/dashboard" className={linkClass("/dashboard")}>
          Dashboard
        </Link>

        <Link href="/pipeline" className={linkClass("/pipeline")}>
          Pipeline
        </Link>

        <Link href="/sales" className={linkClass("/sales")}>
          Sales
        </Link>

        <Link href="/contacts" className={linkClass("/contacts")}>
          Contacts
        </Link>

        <Link href="/vehicles" className={linkClass("/vehicles")}>
          Vehicles
        </Link>

        {canPurchases && (
          <Link href="/purchases" className={linkClass("/purchases")}>
            Purchases
          </Link>
        )}

        {canStock && (
          <div>
            <Link href="/stock" className={linkClass("/stock")}>
              Stock
            </Link>

            <div className="ml-4 mt-1 space-y-1">
              <Link
                href="/stock/transfers"
                className={childLinkClass("/stock/transfers")}
              >
                Stock Transfers
              </Link>
            </div>
          </div>
        )}

        {canInsurance && (
          <Link href="/insurance" className={linkClass("/insurance")}>
            Insurance
          </Link>
        )}

        {canVahan && (
          <Link href="/vahan" className={linkClass("/vahan")}>
            VAHAN
          </Link>
        )}

        {canWhatsappLogs && (
          <Link href="/whatsapp-logs" className={linkClass("/whatsapp-logs")}>
            WhatsApp Logs
          </Link>
        )}

        {canWhatsappSettings && (
          <Link
            href="/settings/whatsapp"
            className={linkClass("/settings/whatsapp")}
          >
            WhatsApp Settings
          </Link>
        )}

        <Link href="/rc" className={linkClass("/rc")}>
          RC
        </Link>

        <Link href="/hsrp" className={linkClass("/hsrp")}>
          HSRP
        </Link>

        {canReports && (
          <div className="pt-2">
            <Link href="/reports" className={reportsParentClass}>
              Reports
            </Link>

            <div className="ml-4 mt-1 space-y-1">
              <Link
                href="/reports/sales"
                className={childLinkClass("/reports/sales")}
              >
                Sales Report
              </Link>

              <Link
                href="/reports/stock"
                className={childLinkClass("/reports/stock")}
              >
                Stock Report
              </Link>
<Link
  href="/reports/odrc"
  className={childLinkClass("/reports/odrc")}
>
  ODRC Report
</Link>

<Link
  href="/reports/stock-ageing"
  className={childLinkClass("/reports/stock-ageing")}
>
  Stock Ageing
</Link>

            </div>
          </div>
        )}

        {canAdminSection && (
          <div className="pt-2">
            <Link href="/admin/users" className={usersParentClass}>
              Users
            </Link>

            <div className="ml-4 mt-1 space-y-1">
              <Link
                href="/admin/active-users"
                className={childLinkClass("/admin/active-users")}
              >
                Active Users
              </Link>

              <Link
                href="/admin/access-window"
                className={childLinkClass("/admin/access-window")}
              >
                Staff Access Time
              </Link>

              {canDashboardPermissions && (
                <Link
                  href="/admin/dashboard-permissions"
                  className={childLinkClass("/admin/dashboard-permissions")}
                >
                  Dashboard Permissions
                </Link>
              )}

              {canPermissions && (
                <Link
                  href="/admin/permissions"
                  className={childLinkClass("/admin/permissions")}
                >
                  Permissions
                </Link>
              )}

              {canDropdowns && (
                <Link
                  href="/admin/dropdowns"
                  className={childLinkClass("/admin/dropdowns")}
                >
                  Dropdowns
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-red-500">
        <button
          onClick={logout}
          className="w-full bg-white text-red-600 py-2 rounded font-semibold"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}