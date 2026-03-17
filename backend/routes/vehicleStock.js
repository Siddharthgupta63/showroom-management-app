const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/authMiddleware");
const stock = require("../controllers/vehicleStockController");

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

// stock list
router.get("/", stock.listStock);

// create purchase / challan / import-entry
router.post("/purchase", requireOwnerAdminManager, stock.createPurchase);

// invoice received later
router.patch("/purchase/:id/update-invoice", requireOwnerAdminManager, stock.updateInvoice);

// stock actions
router.patch("/:id/book", requireOwnerAdminManager, stock.bookVehicle);
router.patch("/:id/unbook", requireOwnerAdminManager, stock.unbookVehicle);
router.patch("/:id/sold", requireOwnerAdminManager, stock.markSold);
router.patch("/:id/delivered", requireOwnerAdminManager, stock.markDelivered);

// excel import
router.get("/import/sample", requireOwnerAdmin, stock.downloadStockImportSample);
router.post("/import", requireOwnerAdmin, ...stock.importStockExcel);

module.exports = router;