const pool = require("../db");

// Ensures one row exists
async function ensureRow() {
  const [rows] = await pool.query("SELECT id FROM whatsapp_settings LIMIT 1");
  if (!rows.length) {
    await pool.query(
      "INSERT INTO whatsapp_settings (enabled, consecutive_failures) VALUES (1, 0)"
    );
  }
}

async function getSettings() {
  await ensureRow();
  const [rows] = await pool.query(
    "SELECT enabled, consecutive_failures FROM whatsapp_settings LIMIT 1"
  );
  const row = rows[0] || { enabled: 1, consecutive_failures: 0 };
  return {
    enabled: !!row.enabled,
    consecutive_failures: Number(row.consecutive_failures || 0),
  };
}

async function setSettings({ enabled }) {
  await ensureRow();
  await pool.query("UPDATE whatsapp_settings SET enabled = ? LIMIT 1", [
    enabled ? 1 : 0,
  ]);
  return getSettings();
}

async function resetFailCounter() {
  await ensureRow();
  await pool.query(
    "UPDATE whatsapp_settings SET consecutive_failures = 0 LIMIT 1"
  );
  return getSettings();
}

module.exports = { getSettings, setSettings, resetFailCounter };
