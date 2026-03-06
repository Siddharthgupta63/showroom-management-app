// backend/routes/vehicleCatalog.js
const express = require("express");
const router = express.Router();
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");
const c = require("../controllers/vehicleCatalogController");

// Everyone logged-in can READ (for dropdowns)
router.use(authMiddleware);

// models
router.get("/models", c.listModels); // returns all; frontend will filter is_active=1
router.post("/models", requireRole(["owner", "admin"]), c.createModel);
router.patch("/models/:id", requireRole(["owner", "admin"]), c.toggleModel);

// variants
router.get("/variants", c.listVariantsByModel);
router.post("/variants", requireRole(["owner", "admin"]), c.createVariant);
router.patch("/variants/:id", requireRole(["owner", "admin"]), c.toggleVariant);

module.exports = router;
