// backend/controllers/rolePresetsController.js
const db = require("../db");

const PERMISSION_DESCRIPTIONS = {
  // Contacts
  contacts_create: "Create new contacts",
  contacts_import: "Import contacts via Excel",
  contacts_edit: "Edit contacts (details/phones/vehicles)",
  contacts_delete: "Deactivate (remove) phones/vehicles in contacts",

  // Existing keys already in your app (keep here for safety)
  add_insurance: "Access Insurance module",
  view_whatsapp_logs: "View WhatsApp Logs",
  manage_whatsapp_settings: "Manage WhatsApp Settings",
  manage_permissions: "Manage permissions & users",
};

const ROLE_PRESETS = {
  // Owner: everything (we compute dynamically from permissions table)
  owner: "__ALL__",

  // Admin: full backoffice
  admin: [
    "manage_permissions",
    "add_insurance",
    "view_whatsapp_logs",
    "manage_whatsapp_settings",

    "contacts_create",
    "contacts_import",
    "contacts_edit",
    "contacts_delete",
  ],

  // Sales: can create/edit contacts (no import/delete)
  sales: ["contacts_create", "contacts_edit"],

  // Insurance staff: insurance + contact edit/view
  insurance: ["add_insurance", "contacts_edit"],

  // RTO staff: can edit contacts (for RC/HSRP workflows)
  rto: ["contacts_edit"],
};

// GET /api/admin/role-presets
exports.getRolePresets = async (req, res) => {
  return res.json({ success: true, presets: ROLE_PRESETS });
};

// POST /api/admin/role-presets/apply
exports.applyRolePresets = async (req, res) => {
  const conn = await db.getConnection();
  try {
    // 1) Ensure permissions exist in permissions table
    const keysToEnsure = Object.keys(PERMISSION_DESCRIPTIONS);
    if (keysToEnsure.length) {
      const values = keysToEnsure.map(() => "(?, ?)").join(", ");
      const params = [];
      keysToEnsure.forEach((k) => params.push(k, PERMISSION_DESCRIPTIONS[k] || ""));
      await conn.query(
        `INSERT INTO permissions (permission_key, description)
         VALUES ${values}
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        params
      );
    }

    // 2) Fetch all permission keys for owner
    const [allPermRows] = await conn.query(`SELECT permission_key FROM permissions`);
    const allKeys = allPermRows.map((r) => r.permission_key);

    // 3) Build final preset map (owner gets all)
    const finalMap = {};
    for (const role of Object.keys(ROLE_PRESETS)) {
      const val = ROLE_PRESETS[role];
      finalMap[role] = val === "__ALL__" ? allKeys : val;
    }

    await conn.beginTransaction();

    // 4) Replace role_permissions for these roles (clean + stable)
    const roles = Object.keys(finalMap);
    if (roles.length) {
      await conn.query(
        `DELETE FROM role_permissions WHERE role IN (${roles.map(() => "?").join(",")})`,
        roles
      );
    }

    // 5) Insert allowed=1 rows
    const rowsToInsert = [];
    for (const role of roles) {
      const keys = Array.isArray(finalMap[role]) ? finalMap[role] : [];
      const uniq = [...new Set(keys.map((x) => String(x).trim()).filter(Boolean))];
      uniq.forEach((k) => rowsToInsert.push([role, k, 1]));
    }

    if (rowsToInsert.length) {
      const values = rowsToInsert.map(() => "(?, ?, ?)").join(", ");
      const params = [];
      rowsToInsert.forEach((r) => params.push(r[0], r[1], r[2]));
      await conn.query(
        `INSERT INTO role_permissions (role, permission_key, allowed) VALUES ${values}`,
        params
      );
    }

    await conn.commit();
    return res.json({ success: true, message: "Role presets applied successfully" });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    console.error("applyRolePresets error:", e);
    return res.status(500).json({ success: false, message: "Failed to apply role presets" });
  } finally {
    conn.release();
  }
};
