// backend/services/settingsService.js
const db = require("../db");

/**
 * Create settings table if it does not exist
 */
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id INT PRIMARY KEY,
      allow_username_login TINYINT(1) DEFAULT 1,
      allow_email_login TINYINT(1) DEFAULT 0,
      allow_mobile_login TINYINT(1) DEFAULT 0,
      allow_password_login TINYINT(1) DEFAULT 1,
      allow_email_otp TINYINT(1) DEFAULT 0,
      allow_mobile_otp TINYINT(1) DEFAULT 0,
      otp_expiry_min INT DEFAULT 10
    )
  `);
}

/**
 * Inserts default row if missing
 */
async function ensureSettingsRow() {
  await ensureTable();

  const [rows] = await db.query("SELECT id FROM settings WHERE id = 1 LIMIT 1");

  if (!rows || rows.length === 0) {
    await db.query(
      `INSERT INTO settings 
      (id, allow_username_login, allow_email_login, allow_mobile_login,
       allow_password_login, allow_email_otp, allow_mobile_otp, otp_expiry_min)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        1,  // id must always be 1
        1,  // username login allowed
        0,  // email login allowed
        0,  // mobile login allowed
        1,  // password login allowed
        0,  // email otp enabled
        0,  // mobile otp enabled
        10  // otp expiry in minutes
      ]
    );
  }
}

/**
 * Get settings
 */
async function getSettings() {
  await ensureSettingsRow();
  const [rows] = await db.query("SELECT * FROM settings WHERE id = 1 LIMIT 1");

  return rows && rows[0] ? rows[0] : null;
}

/**
 * Update settings
 */
async function updateSettings(updates) {
  await ensureSettingsRow();
  const [rows] = await db.query("SELECT * FROM settings WHERE id = 1 LIMIT 1");

  const current = rows[0];

  const newSettings = {
    allow_username_login:
      updates.allow_username_login ?? current.allow_username_login,
    allow_email_login:
      updates.allow_email_login ?? current.allow_email_login,
    allow_mobile_login:
      updates.allow_mobile_login ?? current.allow_mobile_login,
    allow_password_login:
      updates.allow_password_login ?? current.allow_password_login,
    allow_email_otp:
      updates.allow_email_otp ?? current.allow_email_otp,
    allow_mobile_otp:
      updates.allow_mobile_otp ?? current.allow_mobile_otp,
    otp_expiry_min:
      Number.isFinite(Number(updates.otp_expiry_min))
        ? Number(updates.otp_expiry_min)
        : current.otp_expiry_min,
  };

  await db.query(
    `UPDATE settings SET
      allow_username_login = ?,
      allow_email_login = ?,
      allow_mobile_login = ?,
      allow_password_login = ?,
      allow_email_otp = ?,
      allow_mobile_otp = ?,
      otp_expiry_min = ?
     WHERE id = 1`,
    [
      newSettings.allow_username_login,
      newSettings.allow_email_login,
      newSettings.allow_mobile_login,
      newSettings.allow_password_login,
      newSettings.allow_email_otp,
      newSettings.allow_mobile_otp,
      newSettings.otp_expiry_min
    ]
  );

  return getSettings();
}

module.exports = {
  getSettings,
  updateSettings,
};
