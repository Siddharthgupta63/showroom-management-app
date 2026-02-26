// backend/routes/settings.js
const express = require("express");
const router = express.Router();
const settingsService = require("../services/settingsService");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// ---------------------------------------------
// SIMPLE ADMIN AUTH (owner / manager)
// ---------------------------------------------
function requireOwner(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized - No token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload || (payload.role !== "owner" && payload.role !== "manager")) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
      error: err.message,
    });
  }
}

// ------------------------------------------------------------
// PUBLIC ENDPOINT (Frontend login screen reads allowed methods)
// ------------------------------------------------------------
router.get("/login-method", async (req, res) => {
  try {
    const s = await settingsService.getSettings();

    res.json({
      success: true,
      settings: {
        allow_username_login: s.allow_username_login,
        allow_email_login: s.allow_email_login,
        allow_mobile_login: s.allow_mobile_login,
        allow_password_login: s.allow_password_login,
        allow_email_otp: s.allow_email_otp,
        allow_mobile_otp: s.allow_mobile_otp,
        otp_expiry_min: s.otp_expiry_min,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ------------------------------------------------------------
// ADMIN READ SETTINGS
// ------------------------------------------------------------
router.get("/", requireOwner, async (req, res) => {
  try {
    const s = await settingsService.getSettings();
    res.json({ success: true, settings: s });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ------------------------------------------------------------
// ADMIN UPDATE SETTINGS
// body: { allow_username_login, allow_email_login, allow_mobile_login,
//         allow_password_login, allow_email_otp, allow_mobile_otp, otp_expiry_min }
// ------------------------------------------------------------
router.post("/", requireOwner, async (req, res) => {
  try {
    const updated = await settingsService.updateSettings(req.body);

    res.json({
      success: true,
      message: "Settings updated successfully",
      settings: updated,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
