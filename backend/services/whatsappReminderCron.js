// backend/services/whatsappReminderCron.js
const cron = require("node-cron");
const pool = require("../db"); // ✅ db is in backend root

function getWhatsAppSender() {
  try {
    const wa = require("./whatsappProvider"); // same folder
    return (
      wa.sendTemplate ||          // ✅ your cron uses template
      wa.sendText ||              // ✅ for text retry/manual
      wa.sendWhatsAppMessage ||
      wa.sendWhatsappMessage ||
      wa.sendMessage ||
      wa.send ||
      null
    );
  } catch (e) {
    return null;
  }
}



async function ensureSettingsTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS whatsapp_settings (
      id INT NOT NULL PRIMARY KEY,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      consecutive_failures INT NOT NULL DEFAULT 0,
      disabled_reason VARCHAR(255) NULL,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  await pool.query(
    `INSERT INTO whatsapp_settings (id, enabled, consecutive_failures)
     VALUES (1,1,0)
     ON DUPLICATE KEY UPDATE id=id`
  );
}

async function getSettings() {
  await ensureSettingsTable();
  const [rows] = await pool.query("SELECT * FROM whatsapp_settings WHERE id=1");
  return rows?.[0];
}

async function setSettings({ enabled, consecutive_failures, disabled_reason }) {
  await ensureSettingsTable();
  await pool.query(
    `UPDATE whatsapp_settings
     SET enabled=?, consecutive_failures=?, disabled_reason=?
     WHERE id=1`,
    [enabled, consecutive_failures, disabled_reason || null]
  );
}

async function runOnce() {
  const sendFn = getWhatsAppSender();
  if (!sendFn) {
    console.log("⚠️ WhatsApp provider missing: services/whatsappProvider.js");
    return;
  }

  // ✅ A4: Cron respects enabled (DO NOT REMOVE)
  const settings = await getSettings();
  if (!settings?.enabled) {
    console.log(
      "⛔ WhatsApp disabled:",
      settings?.disabled_reason || "too many failures"
    );
    return;
  }

  // ✅ IMPORTANT FIX: track failures during THIS run
  let consecutiveFailures = Number(settings?.consecutive_failures || 0);

  const DAYS_MAX = Number(process.env.WA_REMINDER_DAYS || 3);
  const threshold = Number(process.env.WA_DISABLE_AFTER_FAILS || 5);

  const [policies] = await pool.query(
    `SELECT id, customer_name, phone, policy_no, vehicle_no, expiry_date,
            DATEDIFF(expiry_date, CURDATE()) AS days_left
     FROM insurance_policies
     WHERE expiry_date IS NOT NULL
       AND phone IS NOT NULL
       AND phone <> ''
       AND DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND ?
     ORDER BY days_left ASC
     LIMIT 200`,
    [DAYS_MAX]
  );

  for (const p of policies) {
    // If we got auto-disabled during this run, stop further sending
    if (consecutiveFailures >= threshold) break;

    const phone = String(p.phone || "").replace(/\D/g, "").slice(0, 10);
    if (phone.length !== 10) continue;

    const customer_name = p.customer_name || "Customer";
const policy_no = p.policy_no || "-";
const vehicle_no = p.vehicle_no || "-";
const expiry_date = String(p.expiry_date).slice(0, 10);
const days_left = Number(p.days_left || 0);

// ✅ send template (Meta approved)
const wa = require("./whatsappProvider");
if (!wa.sendTemplate) {
  throw new Error("sendTemplate() not implemented in whatsappProvider.js");
}

await wa.sendTemplate(phone, "renewal_reminder", "en_US", [
  {
    type: "body",
    parameters: [
      { type: "text", text: customer_name },
      { type: "text", text: policy_no },
      { type: "text", text: vehicle_no },
      { type: "text", text: expiry_date },
      { type: "text", text: String(days_left) },
    ],
  },
]);

// For logs table (store readable message also)
const msg =
  `Hello ${customer_name}, Your insurance policy ${policy_no} for vehicle ${vehicle_no} ` +
  `is expiring on ${expiry_date} (in ${days_left} day(s)). Please contact Gupta Auto Agency to renew. Thank you.`;


    let status = "sent";
    let error = null;

    try {
      await sendFn(phone, msg);

      // ✅ success => reset failures
      consecutiveFailures = 0;
      await setSettings({
        enabled: 1,
        consecutive_failures: 0,
        disabled_reason: null,
      });
    } catch (err) {
      status = "failed";
      error = err?.response?.data
        ? JSON.stringify(err.response.data)
        : err?.message || "Unknown error";

      consecutiveFailures += 1;

      if (consecutiveFailures >= threshold) {
        await setSettings({
          enabled: 0,
          consecutive_failures: consecutiveFailures,
          disabled_reason: `Auto-disabled after ${consecutiveFailures} consecutive failures`,
        });
      } else {
        await setSettings({
          enabled: 1,
          consecutive_failures: consecutiveFailures,
          disabled_reason: null,
        });
      }
    }

    await pool.query(
      `INSERT INTO whatsapp_reminders (policy_id, phone, message, status, error)
       VALUES (?, ?, ?, ?, ?)`,
      [p.id, phone, msg, status, error]
    );
  }

  console.log(
    `✅ WhatsApp cron executed. Policies checked: ${policies.length}. Failures: ${consecutiveFailures}`
  );
}

function start() {
  cron.schedule("0 10 * * *", () => runOnce(), { timezone: "Asia/Kolkata" });
  console.log("✅ WhatsApp reminder cron scheduled: 10:00 AM Asia/Kolkata");
}

module.exports = { start, runOnce, getSettings, setSettings };
