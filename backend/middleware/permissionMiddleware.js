// backend/middleware/permissionMiddleware.js
const db = require("../db");

/**
 * requirePermission(permissionKey)
 *
 * Logic:
 * 1) owner/admin always allowed
 * 2) role_permissions(role, permission_key, allowed=1)
 * 3) user_permissions(user_id, permission_key) existence = allowed
 */
function requirePermission(permissionKey) {
  if (!permissionKey || typeof permissionKey !== "string") {
    throw new Error("requirePermission(permissionKey) missing/invalid permissionKey");
  }

  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const roleRaw = req.user?.role;

      if (!userId || !roleRaw) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const role = String(roleRaw).trim().toLowerCase();

      // ✅ owner/admin bypass
      if (role === "owner" || role === "admin") return next();

      // role_permissions check
      const [roleRows] = await db.query(
        `
        SELECT allowed
        FROM role_permissions
        WHERE role = ? AND permission_key = ?
        LIMIT 1
        `,
        [role, permissionKey]
      );

      const roleAllowed = roleRows.length > 0 && Number(roleRows[0].allowed) === 1;

      // user_permissions existence check (NO allowed column)
      const [userRows] = await db.query(
        `
        SELECT 1
        FROM user_permissions
        WHERE user_id = ? AND permission_key = ?
        LIMIT 1
        `,
        [userId, permissionKey]
      );

      const userAllowed = userRows.length > 0;

      if (!roleAllowed && !userAllowed) {
        return res.status(403).json({ success: false, message: "Permission denied" });
      }

      return next();
    } catch (err) {
      console.error("requirePermission error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
}

/**
 * requireAnyPermission([keys...])
 * Allows access if user has at least ONE permission from the list.
 */
function requireAnyPermission(keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error("requireAnyPermission(keys) requires non-empty array");
  }
  const list = keys.map((k) => String(k || "").trim()).filter(Boolean);
  if (list.length === 0) throw new Error("requireAnyPermission(keys) invalid keys");

  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const roleRaw = req.user?.role;

      if (!userId || !roleRaw) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const role = String(roleRaw).trim().toLowerCase();

      // ✅ owner/admin bypass
      if (role === "owner" || role === "admin") return next();

      // role_permissions check (any)
      const [roleRows] = await db.query(
        `
        SELECT 1
        FROM role_permissions
        WHERE role = ? AND allowed = 1 AND permission_key IN (?)
        LIMIT 1
        `,
        [role, list]
      );

      if (roleRows.length > 0) return next();

      // user_permissions check (any)
      const [userRows] = await db.query(
        `
        SELECT 1
        FROM user_permissions
        WHERE user_id = ? AND permission_key IN (?)
        LIMIT 1
        `,
        [userId, list]
      );

      if (userRows.length > 0) return next();

      return res.status(403).json({ success: false, message: "Permission denied" });
    } catch (err) {
      console.error("requireAnyPermission error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
}

module.exports = { requirePermission, requireAnyPermission };
