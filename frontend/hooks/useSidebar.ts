// frontend/hooks/useSidebar.ts
import { useMemo } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { getUser } from "@/lib/auth";

export type SidebarItem = {
  label: string;
  href: string;
};

export function useSidebar() {
  const { hasPermission, loading } = usePermissions();
  const user = getUser();
  const role = String(user?.role || "").toLowerCase();

  const isOwnerAdmin = role === "owner" || role === "admin";

  const canSeePermissions = isOwnerAdmin || hasPermission("manage_permissions");
  const canSeeDropdowns = isOwnerAdmin || hasPermission("manage_dropdowns");

  const sidebarItems: SidebarItem[] = useMemo(() => {
    const items: SidebarItem[] = [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Sales", href: "/sales" },
      { label: "Contacts", href: "/contacts" },
      { label: "Vehicles", href: "/vehicles" }, // ✅ add Vehicles if you want it in sidebar
      { label: "Insurance", href: "/insurance" },
      { label: "WhatsApp Logs", href: "/whatsapp-logs" },
      { label: "WhatsApp Settings", href: "/whatsapp-settings" },
      { label: "RC", href: "/rc" },
      { label: "HSRP", href: "/hsrp" },
    ];

    if (isOwnerAdmin) {
      items.push(
        { label: "Users", href: "/admin/users" },
        { label: "Active Users", href: "/admin/active-users" },
        { label: "Staff Access Time", href: "/admin/access-window" }
      );
    }

    if (canSeePermissions) {
      items.push({ label: "Permissions", href: "/admin/permissions" });
    }

    // ✅ NEW: Dropdown Master menu link
    if (canSeeDropdowns) {
      items.push({ label: "Dropdowns", href: "/admin/dropdowns" });
    }

    return items;
  }, [isOwnerAdmin, canSeePermissions, canSeeDropdowns]);

  return { sidebarItems, loading };
}
