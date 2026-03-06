// backend/controllers/adminUsersController.js
const db = require("../db");
const bcryptjs = require("bcryptjs");

function isOwnerOrAdmin(req) {
  const role = String(req.user?.role || "").toLowerCase();
  return role === "owner" || role === "admin";
}

function forbid(res) {
  return res.status(403).json({ success: false, message: "Forbidden" });
}

/**
 * GET /api/admin/users
 */
exports.listUsers = async (req, res) => {
  try {
    if (!isOwnerOrAdmin(req)) return forbid(res);

    const [rows] = await db.query(
      `
      SELECT id, name, username, email, mobile, role, is_active, created_at, last_active_at
      FROM users
      ORDER BY id DESC
      `
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("listUsers error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load users" });
  }
};

/**
 * GET /api/admin/permissions-catalog
 * returns:
 *  - permissions list
 *  - rolePermissions map
 */
exports.permissionsCatalog = async (req, res) => {
  try {
    if (!isOwnerOrAdmin(req)) return forbid(res);

    const [permissions] = await db.query(
      `SELECT permission_key, description FROM permissions ORDER BY permission_key`
    );

    const [rolePerms] = await db.query(
      `SELECT role, permission_key FROM role_permissions WHERE allowed = 1`
    );

    const rolePermissions = {};
    for (const r of rolePerms) {
      const role = String(r.role).toLowerCase();
      if (!rolePermissions[role]) rolePermissions[role] = [];
      rolePermissions[role].push(r.permission_key);
    }

    return res.json({ success: true, permissions, rolePermissions });
  } catch (err) {
    console.error("permissionsCatalog error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load permissions catalog" });
  }
};

/**
 * POST /api/admin/users
 * Body: { name, username, email, mobile, password, role, is_active, permissions: string[] }
 * permissions = EXTRA perms only (user_permissions)
 */
exports.createUser = async (req, res) => {
  const conn = await db.getConnection();
  try {
    if (!isOwnerOrAdmin(req)) return forbid(res);

    const {
      name,
      username,
      email,
      mobile,
      password,
      role,
      is_active = true,
      permissions = [],
    } = req.body || {};

    const cleanRole = String(role || "").trim().toLowerCase();

    if (!cleanRole) {
      return res.status(400).json({ success: false, message: "Role is required" });
    }
    if (!password || String(password).trim().length < 4) {
      return res
        .status(400)
        .json({ success: false, message: "Password must be at least 4 characters" });
    }

    const u = username ? String(username).trim() : null;
    const e = email ? String(email).trim() : null;
    const m = mobile ? String(mobile).trim() : null;

    if (!u && !e && !m) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one: username OR email OR mobile",
      });
    }

    const hashed = await bcryptjs.hash(String(password), 10);
    const active = is_active ? 1 : 0;

    const requestedPerms = Array.isArray(permissions) ? permissions : [];
    const uniquePerms = [
      ...new Set(requestedPerms.map((x) => String(x).trim()).filter(Boolean)),
    ];

    await conn.beginTransaction();

    const [ins] = await conn.query(
      `
      INSERT INTO users (name, username, email, mobile, password, role, is_active, password_changed_at, token_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 0)
      `,
      [name ? String(name).trim() : null, u, e, m, hashed, cleanRole, active]
    );

    const newUserId = ins.insertId;

    if (uniquePerms.length > 0) {
      const [validRows] = await conn.query(
        `SELECT permission_key FROM permissions WHERE permission_key IN (${uniquePerms
          .map(() => "?")
          .join(",")})`,
        uniquePerms
      );
      const validKeys = new Set(validRows.map((r) => r.permission_key));
      const finalKeys = uniquePerms.filter((k) => validKeys.has(k));

      if (finalKeys.length > 0) {
        const values = finalKeys.map(() => "(?, ?)").join(", ");
        const params = [];
        for (const k of finalKeys) params.push(newUserId, k);

        await conn.query(
          `INSERT INTO user_permissions (user_id, permission_key) VALUES ${values}`,
          params
        );
      }
    }

    await conn.commit();
    return res.json({ success: true, message: "User created", userId: newUserId });
  } catch (err) {
    await conn.rollback();

    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Username / Email already exists. Use different one.",
      });
    }

    console.error("createUser error:", err);
    return res.status(500).json({ success: false, message: "Failed to create user" });
  } finally {
    conn.release();
  }
};

/**
 * GET /api/admin/users/:id
 * Returns user + extraPermissions (user_permissions)
 */
exports.getUser = async (req, res) => {
  try {
    if (!isOwnerOrAdmin(req)) return forbid(res);

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid user id" });

    const [rows] = await db.query(
      `SELECT id, name, username, email, mobile, role, is_active, created_at, last_active_at
       FROM users WHERE id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "User not found" });

    const user = rows[0];

    const [permRows] = await db.query(
      `SELECT permission_key FROM user_permissions WHERE user_id = ? ORDER BY permission_key`,
      [id]
    );

    const extraPermissions = permRows.map((r) => r.permission_key);

    return res.json({ success: true, user, extraPermissions });
  } catch (err) {
    console.error("getUser error:", err);
    return res.status(500).json({ success: false, message: "Failed to load user" });
  }
};

/**
 * PUT /api/admin/users/:id
 * Update user fields + REPLACE extra permissions
 * ✅ If disabling user here, invalidate token (token_version++)
 */
exports.updateUser = async (req, res) => {
  const conn = await db.getConnection();
  try {
    if (!isOwnerOrAdmin(req)) return forbid(res);

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid user id" });

    const {
      name,
      username,
      email,
      mobile,
      role,
      is_active,
      permissions = [],
    } = req.body || {};

    // prevent disabling yourself
    if (Number(req.user?.id) === id && is_active === false) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot disable your own account." });
    }

    const cleanRole = String(role || "").trim().toLowerCase();
    if (!cleanRole) return res.status(400).json({ success: false, message: "Role is required" });

    const u = username ? String(username).trim() : null;
    const e = email ? String(email).trim() : null;
    const m = mobile ? String(mobile).trim() : null;

    if (!u && !e && !m) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one: username OR email OR mobile",
      });
    }

    const active = is_active ? 1 : 0;

    const requestedPerms = Array.isArray(permissions) ? permissions : [];
    const uniquePerms = [
      ...new Set(requestedPerms.map((x) => String(x).trim()).filter(Boolean)),
    ];

    await conn.beginTransaction();

    // read current active state so we only bump token_version when going 1 -> 0
    const [currentRows] = await conn.query(
      `SELECT is_active FROM users WHERE id = ?`,
      [id]
    );
    if (!currentRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const wasActive = Number(currentRows[0].is_active) === 1;
    const willDisable = wasActive && active === 0;

    // update user
    if (willDisable) {
      await conn.query(
        `
        UPDATE users
        SET name = ?, username = ?, email = ?, mobile = ?, role = ?, is_active = ?, token_version = token_version + 1
        WHERE id = ?
        `,
        [name ? String(name).trim() : null, u, e, m, cleanRole, active, id]
      );
    } else {
      await conn.query(
        `
        UPDATE users
        SET name = ?, username = ?, email = ?, mobile = ?, role = ?, is_active = ?
        WHERE id = ?
        `,
        [name ? String(name).trim() : null, u, e, m, cleanRole, active, id]
      );
    }

    // replace extra permissions
    await conn.query(`DELETE FROM user_permissions WHERE user_id = ?`, [id]);

    if (uniquePerms.length > 0) {
      const [validRows] = await conn.query(
        `SELECT permission_key FROM permissions WHERE permission_key IN (${uniquePerms
          .map(() => "?")
          .join(",")})`,
        uniquePerms
      );
      const validKeys = new Set(validRows.map((r) => r.permission_key));
      const finalKeys = uniquePerms.filter((k) => validKeys.has(k));

      if (finalKeys.length > 0) {
        const values = finalKeys.map(() => "(?, ?)").join(", ");
        const params = [];
        for (const k of finalKeys) params.push(id, k);

        await conn.query(
          `INSERT INTO user_permissions (user_id, permission_key) VALUES ${values}`,
          params
        );
      }
    }

    await conn.commit();
    return res.json({ success: true, message: "User updated" });
  } catch (err) {
    await conn.rollback();

    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Username / Email already exists. Use different one.",
      });
    }

    console.error("updateUser error:", err);
    return res.status(500).json({ success: false, message: "Failed to update user" });
  } finally {
    conn.release();
  }
};

/**
 * PATCH /api/admin/users/:id/active
 * Body: { is_active: true/false }
 * ✅ If disabling, invalidate token (token_version++)
 */
exports.setActive = async (req, res) => {
  try {
    if (!isOwnerOrAdmin(req)) return forbid(res);

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid user id" });

    const { is_active } = req.body || {};
    const active = is_active ? 1 : 0;

    if (Number(req.user?.id) === id && active === 0) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot disable your own account." });
    }

    if (active === 0) {
      // ✅ revoke token immediately
      await db.query(
        `UPDATE users SET is_active = ?, token_version = token_version + 1 WHERE id = ?`,
        [active, id]
      );
    } else {
      await db.query(`UPDATE users SET is_active = ? WHERE id = ?`, [active, id]);
    }

    return res.json({ success: true, message: "Status updated" });
  } catch (err) {
    console.error("setActive error:", err);
    return res.status(500).json({ success: false, message: "Failed to update status" });
  }
};

/**
 * POST /api/admin/users/:id/reset-password
 * Body: { newPassword }
 * ✅ resets password_changed_at + invalidates token_version
 */
exports.resetPassword = async (req, res) => {
  try {
    if (!isOwnerOrAdmin(req)) return forbid(res);

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid user id" });

    const { newPassword } = req.body || {};
    if (!newPassword || String(newPassword).trim().length < 4) {
      return res
        .status(400)
        .json({ success: false, message: "Password must be at least 4 characters" });
    }

    const hashed = await bcryptjs.hash(String(newPassword), 10);

    await db.query(
      `UPDATE users 
       SET password = ?, password_changed_at = NOW(), token_version = token_version + 1
       WHERE id = ?`,
      [hashed, id]
    );

    return res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ success: false, message: "Failed to reset password" });
  }
};

// GET /api/admin/active-users
exports.activeUsers = async (req, res) => {
  try {
    // owner/admin only
    const role = String(req.user?.role || "").toLowerCase();
    if (!(role === "owner" || role === "admin")) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const [rows] = await db.query(
      `
      SELECT id, name, username, email, mobile, role, is_active, last_active_at
      FROM users
      ORDER BY last_active_at DESC, id DESC
      `
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("activeUsers error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load active users" });
  }
};

// POST /api/admin/users/:id/force-logout
exports.forceLogout = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (!(role === "owner" || role === "admin")) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    // prevent forcing logout yourself (optional but safer)
    if (Number(req.user?.id) === id) {
      return res.status(400).json({
        success: false,
        message: "You cannot force logout yourself.",
      });
    }

    await db.query(
      `UPDATE users SET token_version = token_version + 1 WHERE id = ?`,
      [id]
    );

    return res.json({ success: true, message: "User session revoked" });
  } catch (err) {
    console.error("forceLogout error:", err);
    return res.status(500).json({ success: false, message: "Failed to force logout" });
  }
};

/**
 * POST /api/admin/role-permissions
 * Body: { rolePermissions: { [role:string]: string[] } }
 * Replaces role_permissions allowed list for each provided role.
 */
exports.updateRolePermissions = async (req, res) => {
  const conn = await db.getConnection();
  try {
    if (!isOwnerOrAdmin(req)) return forbid(res);

    const rolePermissions = req.body?.rolePermissions;
    if (!rolePermissions || typeof rolePermissions !== "object") {
      return res
        .status(400)
        .json({ success: false, message: "rolePermissions object is required" });
    }

    // Load valid permission keys from DB (authoritative)
    const [permRows] = await conn.query(`SELECT permission_key FROM permissions`);
    const valid = new Set(permRows.map((r) => r.permission_key));

    // sanitize input
    const entries = Object.entries(rolePermissions).map(([role, keys]) => {
      const cleanRole = String(role || "").trim().toLowerCase();
      const arr = Array.isArray(keys) ? keys : [];
      const uniq = [...new Set(arr.map((k) => String(k).trim()).filter(Boolean))].filter((k) =>
        valid.has(k)
      );
      return [cleanRole, uniq];
    });

    for (const [role] of entries) {
      if (!role) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid role in rolePermissions" });
      }
    }

    await conn.beginTransaction();

    for (const [role, keys] of entries) {
      // Replace per-role
      await conn.query(`DELETE FROM role_permissions WHERE role = ?`, [role]);

      if (keys.length > 0) {
        const values = keys.map(() => "(?, ?, 1)").join(", ");
        const params = [];
        for (const k of keys) params.push(role, k);

        await conn.query(
          `INSERT INTO role_permissions (role, permission_key, allowed) VALUES ${values}`,
          params
        );
      }
    }

    await conn.commit();
    return res.json({ success: true, message: "Role permissions updated" });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    console.error("updateRolePermissions error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update role permissions" });
  } finally {
    conn.release();
  }
};
