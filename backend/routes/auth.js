// backend/routes/auth.js
const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const { authMiddleware } = require("../middleware/authMiddleware");

// Login
router.post("/login", authController.loginUser);

// Logged-in user profile
router.get("/me", authMiddleware, authController.getProfile);

// 🔄 Session heartbeat (updates users.last_active_at)
router.post("/heartbeat", authMiddleware, authController.heartbeat);

module.exports = router;
