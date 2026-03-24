// backend/routes/insuranceCombined.js
const express = require("express");
const router = express.Router();

const {
  getCombinedInsurance,
  exportCombined,
} = require("../controllers/insuranceCombinedController");

const { authMiddleware } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");

router.get("/", authMiddleware, requirePermission("view_insurance"), getCombinedInsurance);
router.get("/export", authMiddleware, requirePermission("export_insurance"), exportCombined);

module.exports = router;