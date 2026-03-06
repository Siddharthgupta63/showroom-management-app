// backend/controllers/whatsappLogsController.js
const pool = require("../db");

// ✅ Supports your provider export: sendText()
// Also supports other names if you change later
function getWhatsAppSender() {
  try {
    const wa = require("../services/whatsappProvider");
    return (
      wa.sendText ||              // ✅ YOUR CURRENT PROVIDER
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


function escapeCsv(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function getSettings() {
  const [rows] = await pool.query("SELECT * FROM whatsapp_settings WHERE id=1");
  if (!rows.length) {
    await pool.query(
      "INSERT INTO whatsapp_settings (id, enabled, consecutive_failures) VALUES (1,1,0)"
    );
    const [r2] = await pool.query("SELECT * FROM whatsapp_settings WHERE id=1");
    return r2[0];
  }
  return rows[0];
}

async function setSettings({ enabled, consecutive_failures, disabled_reason }) {
  await pool.query(
    `UPDATE whatsapp_settings
     SET enabled=?, consecutive_failures=?, disabled_reason=?
     WHERE id=1`,
    [enabled, consecutive_failures, disabled_reason || null]
  );
}

exports.getLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize || 10)));

    const status = (req.query.status || "").trim(); // sent | failed | ""
    const from = (req.query.from || "").trim(); // YYYY-MM-DD
    const to = (req.query.to || "").trim(); // YYYY-MM-DD

    const where = [];
    const params = [];

    if (status === "sent" || status === "failed") {
      where.push("wr.status = ?");
      params.push(status);
    }

    if (from) {
      where.push("DATE(wr.created_at) >= ?");
      params.push(from);
    }
    if (to) {
      where.push("DATE(wr.created_at) <= ?");
      params.push(to);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM whatsapp_reminders wr
       ${whereSql}`,
      params
    );

    const total = Number(countRow.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    const [rows] = await pool.query(
      `SELECT
         wr.id, wr.policy_id, wr.phone, wr.message, wr.status, wr.error, wr.created_at,
         ip.customer_name, ip.policy_no, ip.vehicle_no
       FROM whatsapp_reminders wr
       LEFT JOIN insurance_policies ip ON ip.id = wr.policy_id
       ${whereSql}
       ORDER BY wr.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const settings = await getSettings();

    res.json({
      success: true,
      data: rows,
      page,
      pageSize,
      total,
      totalPages,
      whatsapp: {
        enabled: !!settings.enabled,
        consecutive_failures: Number(settings.consecutive_failures || 0),
        disabled_reason: settings.disabled_reason || null,
      },
    });
  } catch (e) {
    console.error("getLogs error:", e);
    res.status(500).json({ success: false, message: "Failed to load logs" });
  }
};

exports.getSummary = async (req, res) => {
  try {
    const from = (req.query.from || "").trim();
    const to = (req.query.to || "").trim();

    // default: today
    const where = [];
    const params = [];
    if (from) {
      where.push("DATE(created_at) >= ?");
      params.push(from);
    }
    if (to) {
      where.push("DATE(created_at) <= ?");
      params.push(to);
    }
    if (!from && !to) {
      where.push("DATE(created_at) = CURDATE()");
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[sent]] = await pool.query(
      `SELECT COUNT(*) AS c FROM whatsapp_reminders ${whereSql} AND status='sent'`,
      params
    ).catch(async () => {
      // if whereSql has no WHERE, adjust:
      const baseWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const sql = `SELECT COUNT(*) AS c FROM whatsapp_reminders ${baseWhere} ${
        baseWhere ? "AND" : "WHERE"
      } status='sent'`;
      const [[r]] = await pool.query(sql, params);
      return [[r]];
    });

    const [[failed]] = await pool.query(
      `SELECT COUNT(*) AS c FROM whatsapp_reminders ${whereSql} AND status='failed'`,
      params
    ).catch(async () => {
      const baseWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const sql = `SELECT COUNT(*) AS c FROM whatsapp_reminders ${baseWhere} ${
        baseWhere ? "AND" : "WHERE"
      } status='failed'`;
      const [[r]] = await pool.query(sql, params);
      return [[r]];
    });

    const sentCount = Number(sent.c || 0);
    const failedCount = Number(failed.c || 0);
    const total = sentCount + failedCount;
    const successRate = total === 0 ? 0 : Math.round((sentCount / total) * 1000) / 10; // 1 decimal

    const settings = await getSettings();

    res.json({
      success: true,
      range: from || to ? { from: from || null, to: to || null } : { today: true },
      sent: sentCount,
      failed: failedCount,
      total,
      successRate,
      whatsapp: {
        enabled: !!settings.enabled,
        consecutive_failures: Number(settings.consecutive_failures || 0),
        disabled_reason: settings.disabled_reason || null,
      },
    });
  } catch (e) {
    console.error("getSummary error:", e);
    res.status(500).json({ success: false, message: "Failed to load summary" });
  }
};

exports.exportLogsCsv = async (req, res) => {
  try {
    const status = (req.query.status || "").trim();
    const from = (req.query.from || "").trim();
    const to = (req.query.to || "").trim();

    const where = [];
    const params = [];

    if (status === "sent" || status === "failed") {
      where.push("wr.status = ?");
      params.push(status);
    }
    if (from) {
      where.push("DATE(wr.created_at) >= ?");
      params.push(from);
    }
    if (to) {
      where.push("DATE(wr.created_at) <= ?");
      params.push(to);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `SELECT
         wr.id, wr.created_at, wr.status, wr.phone, wr.error, wr.message,
         ip.customer_name, ip.policy_no, ip.vehicle_no
       FROM whatsapp_reminders wr
       LEFT JOIN insurance_policies ip ON ip.id = wr.policy_id
       ${whereSql}
       ORDER BY wr.id DESC`,
      params
    );

    const header = [
      "id",
      "created_at",
      "status",
      "customer_name",
      "policy_no",
      "vehicle_no",
      "phone",
      "message",
      "error",
    ];

    const csv =
      header.join(",") +
      "\n" +
      rows
        .map((r) =>
          [
            r.id,
            r.created_at,
            r.status,
            r.customer_name,
            r.policy_no,
            r.vehicle_no,
            r.phone,
            r.message,
            r.error,
          ].map(escapeCsv).join(",")
        )
        .join("\n");

    const filename = `whatsapp_logs_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) {
    console.error("exportLogsCsv error:", e);
    res.status(500).json({ success: false, message: "Export failed" });
  }
};

exports.retryLog = async (req, res) => {
  try {
    const id = Number(req.params.id);

    console.log("[WA RETRY] API hit. id =", id);

    const [rows] = await pool.query(
      `SELECT id, phone, message, policy_id FROM whatsapp_reminders WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Log not found" });
    }

    const log = rows[0];

    // ✅ Force print current provider
    console.log("[WA RETRY] WHATSAPP_PROVIDER =", process.env.WHATSAPP_PROVIDER);

    const sendFn = getWhatsAppSender();
    if (!sendFn) {
      console.log("[WA RETRY] sendFn is NULL (provider not found)");
      return res.status(500).json({ success: false, message: "WhatsApp provider not available" });
    }

    let status = "sent";
    let error = null;

    try {
      await sendFn(log.phone, log.message);
      console.log("[WA RETRY] sendFn SUCCESS");
    } catch (err) {
      status = "failed";
      error =
        err?.response?.data
          ? JSON.stringify(err.response.data)
          : err?.message || "Retry failed";
      console.log("[WA RETRY] sendFn FAILED:", error);
    }

    // ✅ Always insert a NEW row (history)
    const [ins] = await pool.query(
      `INSERT INTO whatsapp_reminders (policy_id, phone, message, status, error)
       VALUES (?, ?, ?, ?, ?)`,
      [log.policy_id || null, log.phone, log.message, status, error]
    );

    console.log("[WA RETRY] Inserted new row. insertId =", ins?.insertId);

    return res.json({
      success: true,
      message: "Retry attempted",
      status,
      newId: ins?.insertId || null,
    });
  } catch (e) {
    console.error("retryLog error:", e);
    return res.status(500).json({ success: false, message: "Retry failed" });
  }
};



// GET /api/whatsapp/logs/monthly?months=12
exports.retryBulk = async (req, res) => {
  try {
    const status = (req.body?.status || "failed").trim();
    const from = (req.body?.from || "").trim(); // YYYY-MM-DD
    const to = (req.body?.to || "").trim();     // YYYY-MM-DD
    const limit = Math.min(Math.max(parseInt(req.body?.limit || "50", 10), 1), 500);

    const settings = await getSettings();
    if (!settings.enabled) {
      return res.status(400).json({
        success: false,
        message: `WhatsApp is disabled (${settings.disabled_reason || "too many failures"}).`,
      });
    }

    const sendFn = getWhatsAppSender();
    if (!sendFn) {
      return res.status(500).json({
        success: false,
        message: "WhatsApp provider not found. Check services/whatsappProvider.js",
      });
    }

    const where = [];
    const params = [];

    if (status === "sent" || status === "failed") {
      where.push("wr.status = ?");
      params.push(status);
    } else {
      where.push("wr.status = 'failed'");
    }

    if (from) {
      where.push("DATE(wr.created_at) >= ?");
      params.push(from);
    }
    if (to) {
      where.push("DATE(wr.created_at) <= ?");
      params.push(to);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [logs] = await pool.query(
      `
      SELECT wr.id, wr.phone, wr.message, wr.policy_id
      FROM whatsapp_reminders wr
      ${whereSql}
      ORDER BY wr.id DESC
      LIMIT ?
      `,
      [...params, limit]
    );

    let sent = 0;
    let failed = 0;
    const results = [];

    for (const log of logs) {
      let st = "sent";
      let errText = null;

      try {
        await sendFn(log.phone, log.message);
        sent++;
        await setSettings({ enabled: 1, consecutive_failures: 0, disabled_reason: null });
      } catch (err) {
        st = "failed";
        errText = err?.response?.data
          ? JSON.stringify(err.response.data)
          : err?.message || "Unknown error";
        failed++;

        const threshold = Number(process.env.WA_DISABLE_AFTER_FAILS || 5);
        const newFails = Number(settings.consecutive_failures || 0) + 1;

        if (newFails >= threshold) {
          await setSettings({
            enabled: 0,
            consecutive_failures: newFails,
            disabled_reason: `Auto-disabled after ${newFails} consecutive failures`,
          });
        } else {
          await setSettings({
            enabled: 1,
            consecutive_failures: newFails,
            disabled_reason: null,
          });
        }
      }

      await pool.query(
        `INSERT INTO whatsapp_reminders (policy_id, phone, message, status, error)
         VALUES (?, ?, ?, ?, ?)`,
        [log.policy_id || null, log.phone, log.message, st, errText]
      );

      results.push({ id: log.id, retry: st, error: errText });
    }

    return res.json({
      success: true,
      retried: logs.length,
      sent,
      failed,
      results,
    });
  } catch (e) {
    console.error("retryBulk error:", e);
    return res.status(500).json({ success: false, message: "Bulk retry failed" });
  }
};

