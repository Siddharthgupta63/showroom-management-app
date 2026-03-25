const db = require("../db");

const ALLOWED_SOURCES = new Set(["SALE", "DIRECT", "RENEWAL"]);
const ALLOWED_DISPOSITIONS = new Set([
  "INTERESTED",
  "CALL_BACK",
  "NO_RESPONSE",
  "RENEWED",
  "NOT_INTERESTED",
]);

function normalizeSource(source) {
  return String(source || "").trim().toUpperCase();
}

function isValidDate(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

exports.getFollowups = async (req, res) => {
  try {
    const source = normalizeSource(req.params.source);
    const sourceId = Number(req.params.id);

    if (!ALLOWED_SOURCES.has(source)) {
      return res.status(400).json({ success: false, message: "Invalid source" });
    }

    if (!sourceId) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const [rows] = await db.query(
      `
      SELECT
        l.id,
        l.source,
        l.source_id,
        l.followup_date,
        l.remark,
        l.disposition,
        l.next_followup_date,
        l.created_by,
        l.created_at,
        l.updated_at,
        u.name AS created_by_name
      FROM insurance_followup_logs l
      LEFT JOIN users u ON u.id = l.created_by
      WHERE l.source = ? AND l.source_id = ?
      ORDER BY l.followup_date DESC, l.created_at DESC, l.id DESC
      `,
      [source, sourceId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getFollowups error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createFollowup = async (req, res) => {
  try {
    const source = normalizeSource(req.body.source);
    const sourceId = Number(req.body.source_id);
    const followupDate = req.body.followup_date;
    const remark = req.body.remark ? String(req.body.remark).trim() : null;
    const disposition = String(req.body.disposition || "").trim().toUpperCase();
    const nextFollowupDate = req.body.next_followup_date || null;
    const createdBy = req.user?.id || null;

    if (!ALLOWED_SOURCES.has(source)) {
      return res.status(400).json({ success: false, message: "Invalid source" });
    }

    if (!sourceId) {
      return res.status(400).json({ success: false, message: "Invalid source_id" });
    }

    if (!isValidDate(followupDate)) {
      return res.status(400).json({ success: false, message: "Valid followup_date required" });
    }

    if (!ALLOWED_DISPOSITIONS.has(disposition)) {
      return res.status(400).json({ success: false, message: "Invalid disposition" });
    }

    if (nextFollowupDate && !isValidDate(nextFollowupDate)) {
      return res.status(400).json({ success: false, message: "Invalid next_followup_date" });
    }

    const [result] = await db.query(
      `
      INSERT INTO insurance_followup_logs
      (
        source,
        source_id,
        followup_date,
        remark,
        disposition,
        next_followup_date,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        source,
        sourceId,
        followupDate,
        remark,
        disposition,
        nextFollowupDate,
        createdBy,
      ]
    );

    return res.json({
      success: true,
      message: "Follow-up added successfully",
      id: result.insertId,
    });
  } catch (err) {
    console.error("createFollowup error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateFollowup = async (req, res) => {
  try {
    const id = Number(req.params.followupId);
    const followupDate = req.body.followup_date;
    const remark = req.body.remark ? String(req.body.remark).trim() : null;
    const disposition = String(req.body.disposition || "").trim().toUpperCase();
    const nextFollowupDate = req.body.next_followup_date || null;

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid followup id" });
    }

    if (!isValidDate(followupDate)) {
      return res.status(400).json({ success: false, message: "Valid followup_date required" });
    }

    if (!ALLOWED_DISPOSITIONS.has(disposition)) {
      return res.status(400).json({ success: false, message: "Invalid disposition" });
    }

    if (nextFollowupDate && !isValidDate(nextFollowupDate)) {
      return res.status(400).json({ success: false, message: "Invalid next_followup_date" });
    }

    const [result] = await db.query(
      `
      UPDATE insurance_followup_logs
      SET
        followup_date = ?,
        remark = ?,
        disposition = ?,
        next_followup_date = ?
      WHERE id = ?
      `,
      [followupDate, remark, disposition, nextFollowupDate, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Follow-up not found" });
    }

    return res.json({ success: true, message: "Follow-up updated successfully" });
  } catch (err) {
    console.error("updateFollowup error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteFollowup = async (req, res) => {
  try {
    const id = Number(req.params.followupId);

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid followup id" });
    }

    const [result] = await db.query(
      `DELETE FROM insurance_followup_logs WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Follow-up not found" });
    }

    return res.json({ success: true, message: "Follow-up deleted successfully" });
  } catch (err) {
    console.error("deleteFollowup error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};