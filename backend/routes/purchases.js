// backend/routes/purchases.js
const express = require("express");
const router = express.Router();

const db = require("../db");
const { authMiddleware } = require("../middleware/authMiddleware");
const c = require("../controllers/purchasesController");

async function getUserPermSet(req) {
  const userId = req.user?.id;
  const role = String(req.user?.role || "").toLowerCase();

  const set = new Set();

  // role permissions (allowed=1)
  const [roleRows] = await db.query(
    `SELECT permission_key FROM role_permissions WHERE role = ? AND allowed = 1`,
    [role]
  );
  for (const r of roleRows) set.add(r.permission_key);

  // user permissions (existence = allow)
  const [userRows] = await db.query(
    `SELECT permission_key FROM user_permissions WHERE user_id = ?`,
    [userId]
  );
  for (const u of userRows) set.add(u.permission_key);

  return set;
}

function requireAnyPermission(keys = []) {
  return async (req, res, next) => {
    try {
      const role = String(req.user?.role || "").toLowerCase();
      if (role === "owner" || role === "admin") return next(); // always allow

      const permSet = await getUserPermSet(req);
      const ok = keys.some((k) => permSet.has(k));

      if (!ok) {
        return res.status(403).json({
          success: false,
          message: `Permission denied (${keys.join(" OR ")})`,
        });
      }

      next();
    } catch (e) {
      console.error("requireAnyPermission error:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
}

router.use(authMiddleware);

// View routes (need view_purchases OR manage_purchases)
router.get("/", requireAnyPermission(["view_purchases", "manage_purchases"]), c.listPurchases);
router.get("/:id", requireAnyPermission(["view_purchases", "manage_purchases"]), c.getPurchaseById);

// Manage routes (need manage_purchases)
router.get("/_export", requireAnyPermission(["manage_purchases"]), c.exportPurchasesExcel);
router.post("/from-invoice", requireAnyPermission(["manage_purchases"]), c.createPurchaseFromInvoice);
router.get("/:id/_export-items", requireAnyPermission(["manage_purchases"]), c.exportPurchaseItemsExcel);

module.exports = router;