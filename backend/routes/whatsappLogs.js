// backend/routes/whatsappLogs.js
const express = require("express");
const router = express.Router();

// ✅ works if authMiddleware exports function OR { authMiddleware }
const authMod = require("../middleware/authMiddleware");
const auth = typeof authMod === "function" ? authMod : authMod.authMiddleware;

// ✅ works if permissionMiddleware exports { requirePermission }
const { requirePermission } = require("../middleware/permissionMiddleware");

const whatsappLogsController = require("../controllers/whatsappLogsController");

/**
 * BASE PATH is mounted in server.js:
 * app.use("/api/whatsapp", require("./routes/whatsappLogs"));
 *
 * So endpoints become:
 * GET  /api/whatsapp/logs
 * GET  /api/whatsapp/logs/summary
 * GET  /api/whatsapp/logs/export
 * POST /api/whatsapp/logs/:id/retry
 */

router.get(
  "/logs",
  auth,
  requirePermission("view_whatsapp_logs"),
  whatsappLogsController.getLogs
);

router.get(
  "/logs/summary",
  auth,
  requirePermission("view_whatsapp_logs"),
  whatsappLogsController.getSummary
);

router.get(
  "/logs/export",
  auth,
  requirePermission("export_whatsapp_logs"),
  whatsappLogsController.exportLogsCsv
);

router.post(
  "/logs/:id/retry",
  auth,
  requirePermission("retry_whatsapp_logs"),
  whatsappLogsController.retryLog
);

router.post(
  "/logs/retry-bulk",
  auth,
  requirePermission("retry_whatsapp_logs"),
  whatsappLogsController.retryBulk || (async (req, res) => {
    return res.status(400).json({
      success: false,
      message: "retryBulk not implemented in controller yet",
    });
  })
);


module.exports = router;
