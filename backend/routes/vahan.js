const express = require("express");
const router = express.Router();

const v = require("../controllers/vahanController");
const { authMiddleware } = require("../middleware/authMiddleware");

// all routes require login
router.use(authMiddleware);

// ✅ STATIC routes must come BEFORE /:sale_id
router.get("/", v.listVahan);
router.get("/dashboard-summary", v.dashboardSummary);
router.get("/export", v.exportVahan);

// ✅ dynamic routes after static routes
router.get("/:sale_id", v.getVahan);
router.put("/:sale_id/form", v.saveForm);
router.put("/:sale_id/payment", v.savePayment);
router.post("/:sale_id/complete", v.completeVahan);

// old logic support
router.post("/", v.createVahan);
router.put("/:sale_id", v.updateVahan);
router.delete("/:sale_id", v.deleteVahan);

module.exports = router;