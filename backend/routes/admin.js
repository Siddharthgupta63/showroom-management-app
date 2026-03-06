// backend/routes/admin.js
const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const adminUsersController = require("../controllers/adminUsersController");
const rolePresetsController = require("../controllers/rolePresetsController");

const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

// ------------------------------
// Dashboard permissions (owner only)
// ------------------------------
router.get(
  "/dashboard-permissions",
  authMiddleware,
  requireRole("owner"),
  adminController.getDashboardPermissions
);

router.post(
  "/dashboard-permissions",
  authMiddleware,
  requireRole("owner"),
  adminController.updateDashboardPermissions
);

// ------------------------------
// Role Presets (owner/admin)
// ------------------------------
router.get(
  "/role-presets",
  authMiddleware,
  requireRole(["owner", "admin"]),
  rolePresetsController.getRolePresets
);

router.post(
  "/role-presets/apply",
  authMiddleware,
  requireRole(["owner", "admin"]),
  rolePresetsController.applyRolePresets
);

// ------------------------------
// Logged-in user's permissions
// ------------------------------
router.get("/my-permissions", authMiddleware, adminController.getMyPermissions);

// WhatsApp reminders list (owner/admin based on your controller logic)
router.get("/whatsapp-reminders", authMiddleware, adminController.getWhatsappReminders);

// ------------------------------
// Users (owner/admin)
// ------------------------------
router.get(
  "/users",
  authMiddleware,
  requireRole(["owner", "admin"]),
  adminUsersController.listUsers
);

router.post(
  "/users",
  authMiddleware,
  requireRole(["owner", "admin"]),
  adminUsersController.createUser
);

router.get(
  "/users/:id",
  authMiddleware,
  requireRole(["owner", "admin"]),
  adminUsersController.getUser
);

router.put(
  "/users/:id",
  authMiddleware,
  requireRole(["owner", "admin"]),
  adminUsersController.updateUser
);

router.patch(
  "/users/:id/active",
  authMiddleware,
  requireRole(["owner", "admin"]),
  adminUsersController.setActive
);

router.post(
  "/users/:id/reset-password",
  authMiddleware,
  requireRole(["owner", "admin"]),
  adminUsersController.resetPassword
);

// permissions catalog for user creation UI
router.get(
  "/permissions-catalog",
  authMiddleware,
  requireRole(["owner", "admin"]),
  adminUsersController.permissionsCatalog
);

// ✅ NEW: Save Role Permissions Matrix
router.post(
  "/role-permissions",
  authMiddleware,
  requireRole(["owner", "admin"]),
  adminUsersController.updateRolePermissions
);

// ------------------------------
// Active Users Dashboard (owner/admin)
// ------------------------------
router.get(
  "/active-users",
  authMiddleware,
  requireRole(["owner", "admin"]),
  adminUsersController.activeUsers
);

router.post(
  "/users/:id/force-logout",
  authMiddleware,
  requireRole(["owner", "admin"]),
  adminUsersController.forceLogout
);

router.get(
  "/access-window",
  authMiddleware,
  requireRole("owner"),
  adminController.getAccessWindow
);

router.post(
  "/access-window",
  authMiddleware,
  requireRole("owner"),
  adminController.updateAccessWindow
);

module.exports = router;
