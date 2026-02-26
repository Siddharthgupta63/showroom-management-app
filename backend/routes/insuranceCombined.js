// backend/routes/insuranceCombined.js
const express = require("express");
const router = express.Router();

const {
  getCombinedInsurance,
  exportCombined,
} = require("../controllers/insuranceCombinedController");

const { authMiddleware, requireRole } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");

// list
router.get("/", authMiddleware, requirePermission("view_insurance"), getCombinedInsurance);

// export OWNER ONLY
router.get("/export", authMiddleware, requireRole("owner"), exportCombined);

module.exports = router;
