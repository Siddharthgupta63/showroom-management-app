const pool = require("../db");
const { resetFailCounter } = require("../services/whatsappSettingsService");
const { sendText } = require("../services/whatsappProvider");

// helper: accept true/false OR 1/0 OR "1"/"0"
function toBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
  return false;
}

exports.getSettings = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT enabled, consecutive_failures FROM whatsapp_settings LIMIT 1"
    );
    if (!rows.length) {
      await pool.query(
        "INSERT INTO whatsapp_settings (enabled, consecutive_failures) VALUES (1, 0)"
      );
      return res.json({
        success: true,
        data: { enabled: true, consecutive_failures: 0 },
      });
    }

    res.json({
      success: true,
      data: {
        enabled: !!rows[0].enabled,
        consecutive_failures: Number(rows[0].consecutive_failures || 0),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const enabled = toBool(req.body?.enabled);

    await pool.query(
      "UPDATE whatsapp_settings SET enabled = ? LIMIT 1",
      [enabled ? 1 : 0]
    );

    res.json({ success: true, message: "Updated", data: { enabled } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resetFailCounter = async (req, res) => {
  try {
    const data = await resetFailCounter();
    res.json({ success: true, message: "Fail counter reset", data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/test-whatsapp-send  { phone, message }
exports.testSend = async (req, res) => {
  try {
    const phone = req.body?.phone;
    const message =
      req.body?.message || "Test message from Showroom DMS ✅";

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "phone is required",
      });
    }

    const result = await sendText(phone, message);

    // Optional: store log entry in whatsapp_reminders
    await pool.query(
      `INSERT INTO whatsapp_reminders 
        (policy_id, customer_name, policy_no, vehicle_no, phone, message, status, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [null, "Test", "TEST", "TEST", phone, message, "sent", null]
    );

    res.json({ success: true, message: "Sent", result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
