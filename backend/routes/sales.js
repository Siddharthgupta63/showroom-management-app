// backend/routes/sales.js
const express = require("express");
const router = express.Router();

const { authMiddleware, requireRole } = require("../middleware/authMiddleware");
const salesController = require("../controllers/salesController");

// ----------------------------------------
// ✅ Print route must work in new tab
// - Browser cannot send Authorization header automatically
// - So we support: /api/sales/:id/print?token=JWT
// ----------------------------------------
function injectAuthFromQuery(req, res, next) {
  try {
    const token = String(req.query.token || "").trim();
    if (!req.headers.authorization && token) {
      req.headers.authorization = `Bearer ${token}`;
    }
  } catch {}
  next();
}

// ✅ Print (token in query supported)
router.get("/:id/print", injectAuthFromQuery, authMiddleware, salesController.getSalePrintData);

// 🔐 All other sales routes require login
router.use(authMiddleware);

// ✅ Export sales CSV (owner/admin only)  <-- NOW auth works
router.get("/export", requireRole(["owner", "admin"]), salesController.exportSalesCSV);

// ✅ Trace sales by chassis/engine (pagination supported)
router.get("/trace", salesController.traceSales);

// ✅ List (pagination + search + filters + date range)
router.get("/", salesController.getAllSales);

// ✅ Create new sale
router.post("/", salesController.createSale);

// ✅ Upload old sales (Owner/Admin only)
router.post("/upload-old", requireRole(["owner", "admin"]), ...salesController.uploadOldSales);

// ✅ Sale documents upload (Owner/Admin/Manager)
router.post("/:id/documents", ...salesController.uploadSaleDocuments);


// ✅ Cancel sale (Owner/Admin/Manager)
router.post("/:id/cancel", requireRole(["owner", "admin", "manager"]), salesController.cancelSale);

// ✅ CRUD
router.get("/:id", salesController.getSaleById);
router.put("/:id", requireRole(["owner", "admin", "manager"]), salesController.updateSale);

// ✅ Hard delete (Owner/Admin only)
router.delete("/:id", requireRole(["owner", "admin"]), salesController.deleteSale);

module.exports = router;
