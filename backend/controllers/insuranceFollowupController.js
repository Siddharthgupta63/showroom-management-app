const db = require("../db");

function normalizeSource(source) {
  return String(source || "").trim().toUpperCase();
}

function normalizePayload(body = {}) {
  return {
    followup1_date: body.followup1_date || null,
    followup1_remark: body.followup1_remark || null,
    followup2_date: body.followup2_date || null,
    followup2_remark: body.followup2_remark || null,
    followup3_date: body.followup3_date || null,
    followup3_remark: body.followup3_remark || null,
  };
}

exports.getFollowups = async (req, res) => {
  try {
    const source = normalizeSource(req.params.source);
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    let sql = "";
    let params = [id];

    if (source === "SALE") {
      sql = `
        SELECT
          id,
          followup1_date,
          followup1_remark,
          followup2_date,
          followup2_remark,
          followup3_date,
          followup3_remark
        FROM insurance
        WHERE id = ?
        LIMIT 1
      `;
    } else if (source === "RENEWAL") {
      sql = `
        SELECT
          id,
          followup1_date,
          followup1_remark,
          followup2_date,
          followup2_remark,
          followup3_date,
          followup3_remark
        FROM renewals
        WHERE id = ?
        LIMIT 1
      `;
    } else if (source === "DIRECT") {
      sql = `
        SELECT
          id,
          followup1_date,
          followup1_remark,
          followup2_date,
          followup2_remark,
          followup3_date,
          followup3_remark
        FROM insurance_policies
        WHERE id = ?
        LIMIT 1
      `;
    } else {
      return res.status(400).json({ success: false, message: "Invalid source" });
    }

    const [rows] = await db.query(sql, params);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("getFollowups error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateFollowups = async (req, res) => {
  try {
    const source = normalizeSource(req.params.source);
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const p = normalizePayload(req.body);

    let sql = "";
    let params = [
      p.followup1_date,
      p.followup1_remark,
      p.followup2_date,
      p.followup2_remark,
      p.followup3_date,
      p.followup3_remark,
      id,
    ];

    if (source === "SALE") {
      sql = `
        UPDATE insurance
        SET
          followup1_date = ?,
          followup1_remark = ?,
          followup2_date = ?,
          followup2_remark = ?,
          followup3_date = ?,
          followup3_remark = ?
        WHERE id = ?
      `;
    } else if (source === "RENEWAL") {
      sql = `
        UPDATE renewals
        SET
          followup1_date = ?,
          followup1_remark = ?,
          followup2_date = ?,
          followup2_remark = ?,
          followup3_date = ?,
          followup3_remark = ?
        WHERE id = ?
      `;
    } else if (source === "DIRECT") {
      sql = `
        UPDATE insurance_policies
        SET
          followup1_date = ?,
          followup1_remark = ?,
          followup2_date = ?,
          followup2_remark = ?,
          followup3_date = ?,
          followup3_remark = ?
        WHERE id = ?
      `;
    } else {
      return res.status(400).json({ success: false, message: "Invalid source" });
    }

    const [result] = await db.query(sql, params);

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    return res.json({ success: true, message: "Follow-up updated successfully" });
  } catch (err) {
    console.error("updateFollowups error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};