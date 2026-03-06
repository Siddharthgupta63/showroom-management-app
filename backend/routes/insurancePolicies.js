const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { authMiddleware } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");

const insurancePoliciesController = require("../controllers/insurancePoliciesController");

// Ensure upload folder exists
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

// View list
router.get(
  "/",
  authMiddleware,
  requirePermission("view_insurance"),
  insurancePoliciesController.getAllPolicies
);

// Create single policy (manual add)
router.post(
  "/",
  authMiddleware,
  requirePermission("add_insurance"),
  insurancePoliciesController.createPolicy
);

// Renew policy (if you use PUT/POST renew, keep your existing controller mapping)
router.post(
  "/renew",
  authMiddleware,
  requirePermission("renew_policy"),
  insurancePoliciesController.renewPolicy
);

// Export (permission-based)
router.get(
  "/export",
  authMiddleware,
  requirePermission("export_insurance"),
  insurancePoliciesController.exportPolicies
);

// Import CSV/JSON rows (permission-based)
router.post(
  "/bulk-import",
  authMiddleware,
  requirePermission("import_insurance"),
  insurancePoliciesController.bulkImportPolicies
);

// Import Excel file (permission-based)
router.post(
  "/import",
  authMiddleware,
  requirePermission("import_insurance"),
  upload.single("file"),
  insurancePoliciesController.importPoliciesExcel
);

module.exports = router;
