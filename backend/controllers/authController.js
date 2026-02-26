const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../db");

const PASSWORD_EXPIRY_DAYS = 30;

// ✅ Load allowed permissions for a role
async function getRolePermissions(role) {
  const [rows] = await db.query(
    "SELECT permission_key FROM role_permissions WHERE role = ? AND allowed = 1",
    [role]
  );
  return rows.map((r) => r.permission_key);
}

// =======================
// LOGIN USER
// =======================
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Keep your existing email-login flow unchanged.
    // Only add columns needed for the security rules.
    const [users] = await db.query(
      "SELECT id, name, email, role, password, is_active, password_changed_at, token_version FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const user = users[0];

    // 🚫 Block disabled users at login
    if (Number(user.is_active) !== 1) {
      return res.status(403).json({
        code: "USER_DISABLED",
        message: "Your account is disabled. Please contact admin.",
      });
    }

    // ⏳ Password expiry at login (30 days)
    const lastChange = new Date(user.password_changed_at);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays >= PASSWORD_EXPIRY_DAYS) {
      return res.status(403).json({
        code: "PASSWORD_EXPIRED",
        message: "Password expired. Please contact owner/admin to reset.",
      });
    }
// ✅ Load permissions for this role (allowed=1 only)
const permissions = await getRolePermissions(user.role);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // ✅ token_version is embedded into JWT (tv)
    const token = jwt.sign(
      {
  id: user.id,
  role: user.role,
  permissions, // ✅ add
  tv: Number(user.token_version || 0),
}
,
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      token,
      user: {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  permissions, // ✅ add
},

    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// =======================
// HEARTBEAT (Protected)
// =======================
exports.heartbeat = async (req, res) => {
  try {
    await db.query("UPDATE users SET last_active_at = NOW() WHERE id = ?", [
      req.user.id,
    ]);
    return res.json({ success: true, serverTime: new Date().toISOString() });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =======================
// GET PROFILE
// =======================
exports.getProfile = async (req, res) => {
  try {
    const [users] = await db.query(
  "SELECT id, name, email, role FROM users WHERE id = ?",
  [req.user.id]
);

if (!users.length) return res.status(404).json({ message: "User not found" });

const u = users[0];
const permissions = await getRolePermissions(u.role);

return res.json({
  ...u,
  permissions,
});

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
