const db = require("../db");

function toBool(v) {
  return Number(v || 0) === 1;
}

function rcStatusOf(row) {
  const filePrepared = toBool(row.file_prepared);
  const fileSent = toBool(row.file_sent_to_agent);
  const rcReceived = toBool(row.rc_received_from_agent);
  const delivered = toBool(row.rc_card_delivered);

  if (!filePrepared) return "File Preparation Pending";
  if (!fileSent) return "File Ready";
  if (!rcReceived) return "Sent To Agent";
  if (!delivered) return "RC Received";
  return "Delivered";
}

async function ensureRcRow(saleId, userId) {
  const [rows] = await db.query(
    `SELECT * FROM rc WHERE sale_id = ? ORDER BY id DESC LIMIT 1`,
    [saleId]
  );
  if (rows.length) return rows[0];

  const [result] = await db.query(
    `INSERT INTO rc (sale_id, rc_uploaded_by) VALUES (?, ?)`,
    [saleId, userId || null]
  );

  const [fresh] = await db.query(
    `SELECT * FROM rc WHERE id = ? LIMIT 1`,
    [result.insertId]
  );
  return fresh[0];
}

async function ensureRcStatusRow(saleId, userId) {
  const [rows] = await db.query(
    `SELECT * FROM rc_status WHERE sale_id = ? ORDER BY id DESC LIMIT 1`,
    [saleId]
  );
  if (rows.length) return rows[0];

  const [result] = await db.query(
    `INSERT INTO rc_status (sale_id, rc_uploaded_by) VALUES (?, ?)`,
    [saleId, userId || null]
  );

  const [fresh] = await db.query(
    `SELECT * FROM rc_status WHERE id = ? LIMIT 1`,
    [result.insertId]
  );
  return fresh[0];
}

const getRCs = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        s.id AS sale_id,
        s.customer_name,
        s.mobile_number,
        CONCAT_WS(' ', NULLIF(s.vehicle_make, ''), NULLIF(s.vehicle_model, '')) AS vehicle_model,
        s.sale_date,

        vs.application_number,
        COALESCE(vs.payment_done, 0) AS payment_done,
        vs.rto_number,

        r.id AS rc_id,
        r.rc_number,
        r.rc_issued_date,
        r.notes,

        rs.id AS rc_status_id,
        COALESCE(rs.file_prepared, 0) AS file_prepared,
        rs.file_prepared_date,
        COALESCE(rs.file_sent_to_agent, 0) AS file_sent_to_agent,
        rs.file_sent_to_agent_date,
        rs.agent_name,
        COALESCE(rs.rc_received_from_agent, 0) AS rc_received_from_agent,
        rs.rc_received_from_agent_date,
        COALESCE(rs.rc_card_delivered, 0) AS rc_card_delivered,
        rs.rc_delivered_date

      FROM sales s

      LEFT JOIN (
        SELECT x.*
        FROM vahan_submission x
        INNER JOIN (
          SELECT sale_id, MAX(id) AS max_id
          FROM vahan_submission
          GROUP BY sale_id
        ) t ON t.max_id = x.id
      ) vs ON vs.sale_id = s.id

      LEFT JOIN (
        SELECT x.*
        FROM rc x
        INNER JOIN (
          SELECT sale_id, MAX(id) AS max_id
          FROM rc
          GROUP BY sale_id
        ) t ON t.max_id = x.id
      ) r ON r.sale_id = s.id

      LEFT JOIN (
        SELECT x.*
        FROM rc_status x
        INNER JOIN (
          SELECT sale_id, MAX(id) AS max_id
          FROM rc_status
          GROUP BY sale_id
        ) t ON t.max_id = x.id
      ) rs ON rs.sale_id = s.id

      WHERE COALESCE(s.is_cancelled, 0) = 0
        AND COALESCE(vs.payment_done, 0) = 1
        AND COALESCE(vs.application_number, '') <> ''

      ORDER BY s.id DESC
    `);

    const data = rows.map((r) => ({
      sale_id: r.sale_id,
      customer_name: r.customer_name,
      mobile_number: r.mobile_number || "",
      vehicle_model: r.vehicle_model || "-",
      sale_date: r.sale_date,
      rc_number: r.rto_number || r.rc_number || "",
      rc_issued_date: r.rc_issued_date,
      file_prepared: Number(r.file_prepared || 0),
      file_prepared_date: r.file_prepared_date,
      file_sent_to_agent: Number(r.file_sent_to_agent || 0),
      file_sent_to_agent_date: r.file_sent_to_agent_date,
      agent_name: r.agent_name || "",
      rc_received_from_agent: Number(r.rc_received_from_agent || 0),
      rc_received_from_agent_date: r.rc_received_from_agent_date,
      rc_card_delivered: Number(r.rc_card_delivered || 0),
      rc_delivered_date: r.rc_delivered_date,
      notes: r.notes || "",
      status: rcStatusOf(r),
    }));

    return res.json(data);
  } catch (err) {
    console.error("getRCs error:", err);
    return res.status(500).json({ message: "Server error fetching RC records" });
  }
};

const createRC = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const saleId = Number(req.body.sale_id);

    if (!saleId) {
      return res.status(400).json({ message: "sale_id is required" });
    }

    await ensureRcRow(saleId, userId);
    await ensureRcStatusRow(saleId, userId);

    const filePrepared = Number(req.body.file_prepared || 0) === 1 ? 1 : 0;
    const fileSent = Number(req.body.file_sent_to_agent || 0) === 1 ? 1 : 0;
    const rcReceived = Number(req.body.rc_received_from_agent || 0) === 1 ? 1 : 0;
    const delivered = Number(req.body.rc_card_delivered || 0) === 1 ? 1 : 0;

    await db.query(
      `UPDATE rc
       SET rc_number = COALESCE(NULLIF(?, ''), rc_number),
           rc_issued_date = ?,
           rc_uploaded_by = ?,
           notes = ?
       WHERE sale_id = ?`,
      [
        req.body.rc_number || null,
        req.body.rc_issued_date || null,
        userId,
        req.body.notes || null,
        saleId,
      ]
    );

    await db.query(
      `UPDATE rc_status
       SET file_prepared = ?,
           file_prepared_date = ?,
           file_prepared_by = ?,
           file_sent_to_agent = ?,
           file_sent_to_agent_date = ?,
           agent_name = ?,
           rc_received_from_agent = ?,
           rc_received_from_agent_date = ?,
           rc_received_by = ?,
           rc_card_delivered = ?,
           rc_delivered_date = ?
       WHERE sale_id = ?`,
      [
        filePrepared,
        req.body.file_prepared_date || null,
        filePrepared ? userId : null,
        fileSent,
        req.body.file_sent_to_agent_date || null,
        req.body.agent_name || null,
        rcReceived,
        req.body.rc_received_from_agent_date || null,
        rcReceived ? userId : null,
        delivered,
        req.body.rc_delivered_date || null,
        saleId,
      ]
    );

    return res.json({ success: true, message: "RC saved successfully" });
  } catch (err) {
    console.error("createRC error:", err);
    return res.status(500).json({ message: "Server error saving RC record" });
  }
};

const updateRC = async (req, res) => {
  req.body.sale_id = Number(req.params.id);
  return createRC(req, res);
};

const deleteRC = async (req, res) => {
  try {
    const saleId = Number(req.params.id);
    if (!saleId) {
      return res.status(400).json({ message: "Invalid sale id" });
    }

    await db.query(`DELETE FROM rc_status WHERE sale_id = ?`, [saleId]);
    await db.query(`DELETE FROM rc WHERE sale_id = ?`, [saleId]);

    return res.json({ success: true, message: "RC record deleted successfully" });
  } catch (err) {
    console.error("deleteRC error:", err);
    return res.status(500).json({ message: "Server error deleting RC record" });
  }
};

module.exports = {
  getRCs,
  createRC,
  updateRC,
  deleteRC,
};