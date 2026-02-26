// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const db = require("../db");

const PASSWORD_EXPIRY_DAYS = 30;

// -----------------------------
// Settings cache (avoid DB query each request)
// -----------------------------
let _settingsCache = null;
let _settingsCacheAt = 0;
const SETTINGS_CACHE_TTL_MS = 30 * 1000;

// -----------------------------
// Role-permissions cache (avoid DB query each request)
// -----------------------------
let _rolePermCache = new Map(); // role -> { at: number, perms: string[] }
const ROLE_PERM_CACHE_TTL_MS = 30 * 1000;

async function getRolePermsCached(role) {
  const now = Date.now();
  const key = String(role || "").toLowerCase();
  const hit = _rolePermCache.get(key);
  if (hit && now - hit.at < ROLE_PERM_CACHE_TTL_MS) return hit.perms;

  const [rows] = await db.query(
    "SELECT permission_key FROM role_permissions WHERE role = ? AND allowed = 1",
    [key]
  );
  const perms = rows.map((r) => r.permission_key);

  _rolePermCache.set(key, { at: now, perms });
  return perms;
}


async function getSettingsCached() {
  const now = Date.now();
  if (_settingsCache && now - _settingsCacheAt < SETTINGS_CACHE_TTL_MS) {
    return _settingsCache;
  }

  const [rows] = await db.query(
    `SELECT
       staff_access_enabled,
       staff_access_start,
       staff_access_end
     FROM settings
     ORDER BY id ASC
     LIMIT 1`
  );

  const s = rows?.[0] || {
    staff_access_enabled: 0,
    staff_access_start: "08:00:00",
    staff_access_end: "20:00:00",
  };

  _settingsCache = s;
  _settingsCacheAt = now;
  return s;
}

// -----------------------------
// Time helpers (server is IST in your setup)
// -----------------------------
function timeToMinutes(t) {
  // "08:00:00" or "08:00"
  if (!t) return null;
  const parts = String(t).split(":");
  const hh = Number(parts[0] || 0);
  const mm = Number(parts[1] || 0);
  return hh * 60 + mm;
}

function nowMinutesLocal() {
  const now = new Date(); // server local time (IST)
  return now.getHours() * 60 + now.getMinutes();
}

function isWithinWindow(nowMin, startMin, endMin) {
  if (startMin === null || endMin === null) return true;

  // if same, treat as allowed always
  if (startMin === endMin) return true;

  // Normal window e.g. 08:00 -> 20:00
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;

  // Overnight window e.g. 20:00 -> 08:00
  return nowMin >= startMin || nowMin < endMin;
}

// -----------------------------
// Main auth middleware
// -----------------------------
exports.authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // Load user from DB each request (for is_active / token_version / password_changed_at)
    const [rows] = await db.query(
      `
      SELECT id, role, is_active, password_changed_at, token_version
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    const user = rows[0];

    // ✅ JWT invalidation (token_version)
    const dbTv = Number(user.token_version || 0);
    const jwtTv = Number(decoded.tv || 0);
    if (dbTv !== jwtTv) {
      return res.status(401).json({
        success: false,
        code: "TOKEN_REVOKED",
        message: "Session expired. Please login again.",
      });
    }

    // 🚫 Disabled account
    if (Number(user.is_active) !== 1) {
      return res.status(403).json({
        success: false,
        code: "USER_DISABLED",
        message: "Your account is disabled. Please contact admin.",
      });
    }

    // ⏳ Password expiry (30 days)
    if (user.password_changed_at) {
      const lastChange = new Date(user.password_changed_at);
      const now = new Date();
      const diffDays = Math.floor(
        (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays >= PASSWORD_EXPIRY_DAYS) {
        return res.status(403).json({
          success: false,
          code: "PASSWORD_EXPIRED",
          message: "Password expired. Contact owner/admin to reset.",
        });
      }
    }

    // 🕗 Smart staff access window from settings (Owner/Admin bypass)
    const role = String(user.role || "").toLowerCase();
    const isPrivileged = role === "owner" || role === "admin";

    if (!isPrivileged) {
      const settings = await getSettingsCached();
      const enabled = Number(settings.staff_access_enabled || 0) === 1;

      if (enabled) {
        const startMin = timeToMinutes(settings.staff_access_start);
        const endMin = timeToMinutes(settings.staff_access_end);
        const nowMin = nowMinutesLocal();

        const allowed = isWithinWindow(nowMin, startMin, endMin);
        if (!allowed) {
          const startLabel = String(settings.staff_access_start || "08:00:00").slice(0, 5);
          const endLabel = String(settings.staff_access_end || "20:00:00").slice(0, 5);

          return res.status(403).json({
            success: false,
            code: "ACCESS_TIME_BLOCKED",
            message: `Access allowed only between ${startLabel} and ${endLabel}.`,
          });
        }
      }
    }

    // Attach minimal identity to req
    // ✅ load role permissions (allowed=1 only)
const permissions = await getRolePermsCached(user.role);

// Attach identity + permissions to req
req.user = {
  id: user.id,
  role: user.role,
  permissions,
};


    return next();
  } catch (error) {
    console.error("authMiddleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// -----------------------------
// Role guard helpers
// -----------------------------
exports.requireRole = (roles) => (req, res, next) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }
  next();
};

exports.requireOwner = (req, res, next) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({
      success: false,
      message: "Owner access required",
    });
  }
  next();
};

exports.requirePermission = (permissionKey) => (req, res, next) => {
  const role = String(req.user.role || "").toLowerCase();
  if (role === "owner" || role === "admin") return next();

  const perms = req.user.permissions || [];
  if (perms.includes(permissionKey)) return next();

  return res.status(403).json({ success: false, message: "Permission denied" });
};
