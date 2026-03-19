// backend/routes/hsrp.js

const express = require("express");
const router = express.Router();

const hsrpController = require("../controllers/hsrpController");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

// all routes require login
router.use(authMiddleware);

// VIEW / LIST
router.get(
  "/",
  requireRole("owner", "admin", "manager", "hsrp", "vahan"),
  hsrpController.getHSRPRequests
);

// EXPORT
router.get(
  "/export",
  requireRole("owner", "admin", "manager", "hsrp", "vahan"),
  hsrpController.exportHSRPRequests
);

// OLD CUSTOMER FITMENT
router.post(
  "/old-fitment",
  requireRole("owner", "admin", "manager", "hsrp", "vahan"),
  hsrpController.createOldCustomerFitment
);

router.get(
  "/old-fitment",
  requireRole("owner", "admin", "manager", "hsrp", "vahan"),
  hsrpController.getOldCustomerFitments
);

router.get(
  "/old-fitment/export",
  requireRole("owner", "admin", "manager", "hsrp", "vahan"),
  hsrpController.exportOldCustomerFitments
);

// FITMENT EMPLOYEE DROPDOWN
router.get(
  "/fitment-employees",
  requireRole("owner", "admin", "manager", "hsrp", "vahan"),
  hsrpController.getFitmentEmployees
);

// UPDATE NORMAL SALE-LINKED HSRP
router.put(
  "/:id",
  requireRole("owner", "admin", "manager", "hsrp", "vahan"),
  hsrpController.updateHSRPRequest
);

module.exports = router;