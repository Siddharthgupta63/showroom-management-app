const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/authMiddleware");
const v = require("../controllers/vehiclesController");
const pdfUpload = require("../middleware/pdfUpload");

function requireOwnerAdminManager(req, res, next) {
  const role = String(req.user?.role || "").toLowerCase();
  if (role === "owner" || role === "admin" || role === "manager") return next();
  return res.status(403).json({ success: false, message: "Only owner/admin/manager" });
}

function requireOwnerAdmin(req, res, next) {
  const role = String(req.user?.role || "").toLowerCase();
  if (role === "owner" || role === "admin") return next();
  return res.status(403).json({ success: false, message: "Only owner/admin" });
}

router.use(authMiddleware);

// =====================================================
// PUBLIC (authenticated users)
// =====================================================

// Everyone can view + add
router.get("/", v.listSearch);
router.post("/", v.createVehicle);

// =====================================================
// Duplicate Preview (manual inline preview)
// NOTE: keep ALL "underscore" routes ABOVE any "/:id" routes
// =====================================================

// ✅ changed: allow all authenticated staff
router.post("/_duplicate/status", v.duplicateStatus);
router.post("/_duplicate/status-bulk", v.duplicateStatusBulk);

// =====================================================
// OWNER / ADMIN ONLY
// =====================================================

// Excel template + import + export
router.get("/_import/template", requireOwnerAdmin, v.downloadImportTemplate);
router.post("/_import", requireOwnerAdmin, ...v.importVehiclesExcel);
router.get("/_export", requireOwnerAdmin, v.exportVehiclesExcel);

// =====================================================
// INVOICE PDF (Phase-2 Upgrade)
// =====================================================

// Extract invoice (model/variant/color detect + duplicate preview)
// ✅ changed: allow all authenticated staff
router.post(
  "/_invoice/extract",
  pdfUpload.single("file"),
  v.extractInvoicePdf
);

// ✅ Safe bulk create (duplicate-safe, no ER_DUP_ENTRY to UI)
// ✅ changed: allow all authenticated staff
router.post(
  "/_invoice/create-bulk",
  v.createVehiclesFromInvoiceBulk
);

// Timeline + sales + view (everyone can view)
router.get("/:id/timeline", v.getVehicleTimeline);
router.get("/:id/sales", v.getVehicleSales);
router.get("/:id", v.getVehicleById);

// =====================================================
// EDIT + DELETE (Owner/Admin only)
// =====================================================

router.put("/:id", requireOwnerAdmin, v.updateVehicle);
router.delete("/:id", requireOwnerAdmin, v.deleteVehicle);

module.exports = router;