// routes/rc.js

const express = require("express");
const router = express.Router();

const rcController = require("../controllers/rcController");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

// All /api/rc routes require authentication
router.use(authMiddleware);

// GET /api/rc
router.get(
  "/",
  requireRole("owner", "admin", "manager", "rc", "vahan"),
  rcController.getRCs
);

// POST /api/rc
router.post(
  "/",
  requireRole("owner", "admin", "manager", "rc", "vahan"),
  rcController.createRC
);

// PUT /api/rc/:id
router.put(
  "/:id",
  requireRole("owner", "admin", "manager", "rc", "vahan"),
  rcController.updateRC
);

// DELETE /api/rc/:id  (owner/admin only)
router.delete(
  "/:id",
  requireRole("owner", "admin"),
  rcController.deleteRC
);

module.exports = router;