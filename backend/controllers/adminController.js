// backend/controllers/adminController.js

const db = require("../db");

/**
 * GET dashboard permissions
 */
exports.getDashboardPermissions = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT role, metric_key, is_visible
      FROM dashboard_permissions
      ORDER BY role, metric_key
      `
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("getDashboardPermissions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard permissions",
    });
  }
};

/**
 * UPDATE dashboard permissions
 */
exports.updateDashboardPermissions = async (req, res) => {
  try {
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: "permissions must be an array",
      });
    }

    for (const p of permissions) {
      await db.query(
        `
        INSERT INTO dashboard_permissions (role, metric_key, is_visible)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible)
        `,
        [p.role, p.metric_key, p.is_visible ? 1 : 0]
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("updateDashboardPermissions error:", err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * GET logged-in user's permissions
 *
 * IMPORTANT:
 * - role_permissions has allowed column (allowed=1)
 * - user_permissions table in your DB DOES NOT have allowed column
 *   so we treat existence as allowed.
 */
exports.getMyPermissions = async (req, res) => {
  try {
    const userId = req.user?.id;
    const roleRaw = req.user?.role;

    if (!userId || !roleRaw) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const role = String(roleRaw).trim().toLowerCase();

    // 1) role permissions
    const [roleRows] = await db.query(
      `
      SELECT permission_key
      FROM role_permissions
      WHERE role = ? AND allowed = 1
      `,
      [role]
    );

    // 2) user permissions (existence = allow)
    const [userRows] = await db.query(
      `
      SELECT permission_key
      FROM user_permissions
      WHERE user_id = ?
      `,
      [userId]
    );

    const permissions = {};
    for (const r of roleRows) permissions[r.permission_key] = true;
    for (const u of userRows) permissions[u.permission_key] = true;

    return res.json({ success: true, permissions });
  } catch (error) {
    console.error("getMyPermissions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load permissions",
    });
  }
};

// ===============================
// WhatsApp Reminder Logs (Owner/Admin)
// GET /api/admin/whatsapp-reminders
// ===============================
exports.getWhatsappReminders = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "owner" && role !== "admin") {
      return res.status(403).json({ success: false, message: "Permission denied" });
    }

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || "20", 10), 5), 100);

    const status = (req.query.status || "").trim(); // sent | failed | ""
    const phone = (req.query.phone || "").trim();
    const from = (req.query.from || "").trim(); // YYYY-MM-DD
    const to = (req.query.to || "").trim(); // YYYY-MM-DD

    const where = [];
    const params = [];

    if (status && (status === "sent" || status === "failed")) {
      where.push("wr.status = ?");
      params.push(status);
    }

    if (phone) {
      where.push("wr.phone LIKE ?");
      params.push(`%${phone}%`);
    }

    // created_at date range
    if (from) {
      where.push("DATE(wr.created_at) >= ?");
      params.push(from);
    }

    if (to) {
      where.push("DATE(wr.created_at) <= ?");
      params.push(to);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // total count
    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM whatsapp_reminders wr
      ${whereSql}
      `,
      params
    );

    const total = Number(countRows?.[0]?.total || 0);
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const offset = (page - 1) * pageSize;

    const [rows] = await db.query(
      `
      SELECT
        wr.id,
        wr.policy_id,
        wr.phone,
        wr.message,
        wr.status,
        wr.error,
        wr.created_at,
        ip.policy_no,
        ip.customer_name,
        ip.vehicle_no,
        ip.expiry_date
      FROM whatsapp_reminders wr
      LEFT JOIN insurance_policies ip ON ip.id = wr.policy_id
      ${whereSql}
      ORDER BY wr.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    return res.json({
      success: true,
      page,
      pageSize,
      total,
      totalPages,
      data: rows,
    });
  } catch (err) {
    console.error("getWhatsappReminders error:", err);
    return res.status(500).json({ success: false, message: "Failed to load WhatsApp logs" });
  }
};

// GET /api/admin/access-window
exports.getAccessWindow = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT staff_access_enabled, staff_access_start, staff_access_end
       FROM settings
       ORDER BY id ASC
       LIMIT 1`
    );

    const s = rows?.[0] || {
      staff_access_enabled: 1,
      staff_access_start: "08:00:00",
      staff_access_end: "20:00:00",
    };

    return res.json({ success: true, data: s });
  } catch (e) {
    console.error("getAccessWindow error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/admin/access-window
exports.updateAccessWindow = async (req, res) => {
  try {
    const { enabled, start, end } = req.body || {};

    // Validate
    const staff_access_enabled = enabled ? 1 : 0;

    const staff_access_start = typeof start === "string" ? start.trim() : "08:00:00";
    const staff_access_end = typeof end === "string" ? end.trim() : "20:00:00";

    // accept "HH:MM" or "HH:MM:SS"
    const normalize = (t) => (t.length === 5 ? `${t}:00` : t);
    const startNorm = normalize(staff_access_start);
    const endNorm = normalize(staff_access_end);

    await db.query(
      `UPDATE settings
       SET staff_access_enabled = ?, staff_access_start = ?, staff_access_end = ?
       WHERE id = (SELECT id FROM (SELECT id FROM settings ORDER BY id ASC LIMIT 1) x)`,
      [staff_access_enabled, startNorm, endNorm]
    );

    return res.json({ success: true, message: "Access window updated" });
  } catch (e) {
    console.error("updateAccessWindow error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

