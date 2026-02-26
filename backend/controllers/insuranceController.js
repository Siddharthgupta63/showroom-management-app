// backend/controllers/insuranceController.js

const db = require("../db");
const XLSX = require("xlsx");

/**
 * POST /api/insurance/:sale_id
 * Required now: customer_name, vehicle_no, phone, start_date
 * expiry_date is calculated by trigger (send NULL)
 */
exports.createInsurance = async (req, res) => {
  try {
    const sale_id = req.params.sale_id;

    const {
      customer_name,
      vehicle_no,
      phone,
      chassis_number,
      insurance_type,
      company,
      policy_number,
      cpa_included,
      cpa_number,
      premium_amount,
      start_date,
      invoice_number,
      remarks,
    } = req.body;

    // Check if insurance already exists for this sale
    const [existing] = await db.query("SELECT id FROM insurance WHERE sale_id = ?", [sale_id]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "Insurance already exists for this sale" });
    }

    const renewed_by = req.user?.id || null;

    const [result] = await db.query(
      `INSERT INTO insurance
        (sale_id, chassis_number, customer_name, vehicle_no, phone,
         insurance_type, company, policy_number, cpa_included, cpa_number,
         premium_amount, start_date, expiry_date, invoice_number, renewed_by, remarks)
       VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      [
        sale_id,
        chassis_number || null,
        customer_name,
        vehicle_no,
        phone,
        insurance_type,
        company || null,
        policy_number || null,
        cpa_included ? 1 : 0,
        cpa_number || null,
        premium_amount || 0,
        start_date,
        invoice_number || null,
        renewed_by,
        remarks || null,
      ]
    );

    return res.status(201).json({ success: true, message: "Insurance created", insuranceId: result.insertId });
  } catch (err) {
    console.error("createInsurance error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInsurance = async (req, res) => {
  try {
    const sale_id = req.params.sale_id;

    const [rows] = await db.query("SELECT * FROM insurance WHERE sale_id = ?", [sale_id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "No insurance record for this sale" });
    }

    return res.json({ success: true, insurance: rows[0] });
  } catch (err) {
    console.error("getInsurance error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateInsurance = async (req, res) => {
  try {
    const sale_id = req.params.sale_id;

    const {
      customer_name,
      vehicle_no,
      phone,
      chassis_number,
      insurance_type,
      company,
      policy_number,
      cpa_included,
      cpa_number,
      premium_amount,
      start_date,
      invoice_number,
      remarks,
    } = req.body;

    const [existing] = await db.query("SELECT id FROM insurance WHERE sale_id = ?", [sale_id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Cannot update — insurance record not found" });
    }

    await db.query(
      `UPDATE insurance SET
        chassis_number = ?,
        customer_name = ?,
        vehicle_no = ?,
        phone = ?,
        insurance_type = ?,
        company = ?,
        policy_number = ?,
        cpa_included = ?,
        cpa_number = ?,
        premium_amount = ?,
        start_date = ?,
        expiry_date = NULL,
        invoice_number = ?,
        remarks = ?
       WHERE sale_id = ?`,
      [
        chassis_number || null,
        customer_name,
        vehicle_no,
        phone,
        insurance_type,
        company || null,
        policy_number || null,
        cpa_included ? 1 : 0,
        cpa_number || null,
        premium_amount || 0,
        start_date,
        invoice_number || null,
        remarks || null,
        sale_id,
      ]
    );

    return res.json({ success: true, message: "Insurance updated", sale_id });
  } catch (err) {
    console.error("updateInsurance error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/insurance/export
 * Export from VIEW (includes both SALE + RENEWAL) - preferred
 */
exports.exportInsurance = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        source,
        customer_name,
        mobile_number,
        vehicle_model,
        chassis_number,
        company,
        policy_number,
        start_date,
        expiry_date,
        days_left
      FROM insurance_combined_view
      ORDER BY expiry_date ASC
    `);

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Insurance");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=insurance_policies.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  } catch (err) {
    console.error("exportInsurance error:", err);
    return res.status(500).json({ success: false, message: "Export failed" });
  }
};

/**
 * POST /api/insurance/renew/:id
 * Renew means: update start_date -> trigger recalculates expiry_date
 */
exports.renewPolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      customer_name,
      vehicle_no,
      phone,
      start_date,
      chassis_number,
    } = req.body;

    const renewed_by = req.user?.id || null;

    await db.query(
      `UPDATE insurance
       SET customer_name = ?,
           vehicle_no = ?,
           phone = ?,
           chassis_number = ?,
           start_date = ?,
           expiry_date = NULL,
           renewal_date = CURDATE(),
           renewed_by = ?
       WHERE id = ?`,
      [customer_name, vehicle_no, phone, chassis_number || null, start_date, renewed_by, id]
    );

    return res.json({ success: true, message: "Policy renewed" });
  } catch (err) {
    console.error("renewPolicy error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/insurance
 */
exports.getAllInsurance = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *,
        CASE
          WHEN days_left < 0 THEN 'black'
          WHEN days_left BETWEEN 0 AND 3 THEN 'red'
          WHEN days_left BETWEEN 4 AND 10 THEN 'orange'
          ELSE 'green'
        END AS status_color
      FROM insurance_combined_view
      ORDER BY
        CASE WHEN days_left = 0 THEN 0 ELSE 1 END ASC,
        CASE WHEN days_left < 0 THEN 1 ELSE 0 END ASC,
        CASE WHEN days_left >= 0 THEN days_left ELSE 999999 END ASC,
        CASE WHEN days_left < 0 THEN days_left ELSE -999999 END DESC,
        expiry_date ASC,
        id DESC
    `);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getAllInsurance error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch insurance list" });
  }
};
