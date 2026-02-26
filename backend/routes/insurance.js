// backend/routes/insurance.js

const express = require("express");
const router = express.Router();

const insuranceController = require("../controllers/insuranceController");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const { validateInsuranceRequired } = require("../middleware/validateInsurance");

// ✅ LIST (combined table)
router.get("/", authMiddleware, requirePermission("view_insurance"), insuranceController.getAllInsurance);

// ✅ EXPORT (permissioned)
router.get("/export", authMiddleware, requireRole("owner"), requirePermission("export_excel"), insuranceController.exportInsurance);





// ✅ RENEW (permissioned + validated)
router.post(
  "/renew/:id",
  authMiddleware,
  requirePermission("renew_policy"),
  validateInsuranceRequired,
  insuranceController.renewPolicy
);

// ✅ CREATE NEW INSURANCE FOR A SALE (role-based + validated)
router.post(
  "/:sale_id",
  authMiddleware,
  requireRole("owner", "manager", "sales"),
  validateInsuranceRequired,
  insuranceController.createInsurance
);

// ✅ GET INSURANCE FOR A SALE
router.get("/:sale_id", authMiddleware, requireRole("owner", "manager", "sales"), insuranceController.getInsurance);

// ✅ UPDATE INSURANCE FOR A SALE (validated)
router.put(
  "/:sale_id",
  authMiddleware,
  requireRole("owner", "manager", "sales"),
  validateInsuranceRequired,
  insuranceController.updateInsurance
);

module.exports = router;
