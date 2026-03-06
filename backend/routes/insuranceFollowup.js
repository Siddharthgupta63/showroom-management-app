// backend/routes/insuranceFollowup.js
const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/insuranceFollowupController");

const authMod = require("../middleware/authMiddleware");
const authMiddleware = authMod.authMiddleware || authMod;

const permMod = require("../middleware/permissionMiddleware");
const requirePermission = permMod.requirePermission || permMod;

router.get("/:source/:id", authMiddleware, requirePermission("view_insurance"), ctrl.getFollowups);

router.put("/:source/:id", authMiddleware, requirePermission("renew_policy"), ctrl.updateFollowups);

module.exports = router;
