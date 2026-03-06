// backend/routes/branches.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

router.use(authMiddleware);

// List active branches (for sales/new dropdown)
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, branch_name, address, is_active
       FROM showroom_branches
       WHERE is_active = 1
       ORDER BY id ASC`
    );
    res.json({ success: true, data: rows || [] });
  } catch (e) {
    console.error("branches list error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// (Optional) owner/admin can add branches
router.post("/", requireRole(["owner", "admin"]), async (req, res) => {
  try {
    const name = String(req.body.branch_name || "").trim();
    const address = req.body.address ? String(req.body.address) : null;
    if (!name) return res.status(400).json({ success: false, message: "branch_name required" });

    const [r] = await db.query(
      `INSERT INTO showroom_branches (branch_name, address, is_active) VALUES (?,?,1)`,
      [name, address]
    );
    res.json({ success: true, id: r.insertId });
  } catch (e) {
    console.error("branches create error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
