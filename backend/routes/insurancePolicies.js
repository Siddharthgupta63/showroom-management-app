const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();
const c = require("../controllers/insurancePoliciesController");
const { authMiddleware } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");

const uploadDir = path.join(__dirname, "..", "uploads", "inspection");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `insurance_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const mime = String(file.mimetype || "").toLowerCase();
  if (mime.startsWith("image/") || mime === "application/pdf") return cb(null, true);
  return cb(new Error("Only image or PDF files are allowed"));
}

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter,
});

function uploadPolicyFile(req, res, next) {
  upload.fields([
    { name: "uploaded_file", maxCount: 1 },
    { name: "inspection_photo", maxCount: 1 }, // backward compatibility
  ])(req, res, function (err) {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Upload failed",
      });
    }
    next();
  });
}

router.get("/", authMiddleware, requirePermission("view_insurance"), c.getAllPolicies);
router.get("/form-meta", authMiddleware, requirePermission("add_insurance"), c.getFormMeta);
router.get("/export", authMiddleware, requirePermission("export_insurance"), c.exportPolicies);

router.post(
  "/",
  authMiddleware,
  requirePermission("add_insurance"),
  uploadPolicyFile,
  c.createPolicy
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission("renew_policy"),
  c.updatePolicyBasic
);

router.post(
  "/bulk-import",
  authMiddleware,
  requirePermission("import_insurance"),
  c.bulkImportPolicies
);

router.post(
  "/import",
  authMiddleware,
  requirePermission("import_insurance"),
  upload.single("file"),
  c.importPoliciesExcel
);

module.exports = router;