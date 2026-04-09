const express = require("express");
const router = express.Router();

const reportsController = require("../controllers/reportsController");
const { authMiddleware } = require("../middleware/authMiddleware");

// If you already use requirePermission middleware, uncomment below
// const { requirePermission } = require("../middleware/permissionMiddleware");

// ---------- SALES REPORT ----------
router.get(
  "/sales",
  authMiddleware,
  // requirePermission("view_reports"),
  reportsController.getSalesReport
);

router.get(
  "/sales/analytics",
  authMiddleware,
  reportsController.getSalesAnalytics
);

router.get(
  "/sales/export",
  authMiddleware,
  // requirePermission("export_reports"),
  reportsController.exportSalesReport
);

router.get(
  "/stock/odrc",
  authMiddleware,
  reportsController.getStockOdrcReport
);

router.get(
  "/stock/odrc/export",
  authMiddleware,
  reportsController.exportStockOdrcReport
);

router.get(
  "/stock/ageing",
  authMiddleware,
  reportsController.getStockAgeingReport
);

router.get(
  "/stock/ageing/export",
  authMiddleware,
  reportsController.exportStockAgeingReport
);

// ---------- STOCK REPORT ----------
router.get(
  "/stock",
  authMiddleware,
  // requirePermission("view_reports"),
  reportsController.getStockReport
);

router.get(
  "/stock/export",
  authMiddleware,
  // requirePermission("export_reports"),
  reportsController.exportStockReport
);

module.exports = router;