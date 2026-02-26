// backend/routes/dropdowns.js
const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");

const c = require("../controllers/dropdownsController");

// For normal app usage (Sales form etc) - returns active only
router.get("/", authMiddleware, c.getDropdowns);

// Admin screen: view all (active + inactive)
router.get("/admin", authMiddleware, requirePermission("manage_dropdowns"), c.getDropdownsAdmin);

// Add new value (owner/admin or manage_dropdowns)
router.post("/:type", authMiddleware, requirePermission("manage_dropdowns"), c.addDropdownValue);

// Disable/Enable (soft delete)
router.patch("/:id", authMiddleware, requirePermission("manage_dropdowns"), c.setActive);

module.exports = router;
