const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();
const renewalController = require("../controllers/renewalController");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");

const uploadDir = path.join(__dirname, "..", "uploads", "inspection");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `renewal_inspection_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({ storage });

router.get(
  "/dashboard",
  authMiddleware,
  requirePermission("view_insurance"),
  renewalController.getRenewalDashboard
);

router.get(
  "/export",
  authMiddleware,
  requirePermission("export_insurance"),
  renewalController.exportRenewalDashboard
);

router.post(
  "/:sale_id",
  authMiddleware,
  requireRole("owner", "admin", "manager", "renewal", "sales", "rc"),
  upload.single("inspection_photo"),
  renewalController.createRenewal
);

module.exports = router;