// backend/controllers/insuranceFollowupController.js
const pool = require("../db"); // adjust if your db export name differs

function tableFromSource(source) {
  const s = String(source || "").toUpperCase();
  if (s === "SALE") return "insurance";
  if (s === "RENEWAL") return "insurance_policies";
  return null;
}

exports.getFollowups = async (req, res) => {
  try {
    const { source, id } = req.params;
    const table = tableFromSource(source);
    if (!table) return res.status(400).json({ success: false, message: "Invalid source" });

    const [rows] = await pool.query(
      `SELECT
        id,
        followup1_date, followup1_remark,
        followup2_date, followup2_remark,
        followup3_date, followup3_remark
       FROM ${table}
       WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, data: rows[0] });
  } catch (e) {
    console.error("getFollowups error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateFollowups = async (req, res) => {
  try {
    const { source, id } = req.params;
    const table = tableFromSource(source);
    if (!table) return res.status(400).json({ success: false, message: "Invalid source" });

    const body = req.body || {};
    const payload = {
      followup1_date: body.followup1_date || null,
      followup1_remark: body.followup1_remark || null,
      followup2_date: body.followup2_date || null,
      followup2_remark: body.followup2_remark || null,
      followup3_date: body.followup3_date || null,
      followup3_remark: body.followup3_remark || null,
    };

    await pool.query(
      `UPDATE ${table}
       SET
         followup1_date = ?,
         followup1_remark = ?,
         followup2_date = ?,
         followup2_remark = ?,
         followup3_date = ?,
         followup3_remark = ?
       WHERE id = ?`,
      [
        payload.followup1_date,
        payload.followup1_remark,
        payload.followup2_date,
        payload.followup2_remark,
        payload.followup3_date,
        payload.followup3_remark,
        id,
      ]
    );

    return res.json({ success: true, message: "Followups updated" });
  } catch (e) {
    console.error("updateFollowups error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
