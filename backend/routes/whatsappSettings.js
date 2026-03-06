const express = require("express");
const router = express.Router();

const authMod = require("../middleware/authMiddleware");
const auth = typeof authMod === "function" ? authMod : authMod.authMiddleware;

const { requirePermission } = require("../middleware/permissionMiddleware");
const whatsappSettingsController = require("../controllers/whatsappSettingsController");

// Mounted in server.js as: app.use("/api", whatsappSettingsRoutes);

// GET settings
router.get(
  "/whatsapp/settings",
  auth,
  requirePermission("manage_whatsapp_settings"),
  whatsappSettingsController.getSettings
);

// UPDATE settings
router.post(
  "/whatsapp/settings",
  auth,
  requirePermission("manage_whatsapp_settings"),
  whatsappSettingsController.updateSettings
);

// RESET FAIL COUNTER
router.post(
  "/whatsapp/reset-fail-counter",
  auth,
  requirePermission("manage_whatsapp_settings"),
  whatsappSettingsController.resetFailCounter
);

// TEST SEND (Postman wants /api/test-whatsapp-send)
router.post(
  "/test-whatsapp-send",
  auth,
  requirePermission("test_whatsapp_send"),
  whatsappSettingsController.testSend
);

module.exports = router;
