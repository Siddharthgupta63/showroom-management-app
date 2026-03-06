// backend/controllers/insurancePoliciesController.js
const db = require("../db");
const XLSX = require("xlsx");
const fs = require("fs");

/**
 * GET /api/insurance-policies
 */
exports.getAllPolicies = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, policy_no, customer_name, vehicle_no, model_name, company, phone, start_date, expiry_date, premium,
              followup1_date, followup1_remark, followup2_date, followup2_remark, followup3_date, followup3_remark
       FROM insurance_policies
       ORDER BY expiry_date ASC, id DESC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getAllPolicies error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

function normalizePhone(p) {
  const s = String(p ?? "").replace(/\D/g, "");
  return s;
}

function isValidPhone10(p) {
  return /^[0-9]{10}$/.test(p);
}

// ✅ Convert Excel/JS Date/string/serial → YYYY-MM-DD (MySQL DATE safe)
function toYYYYMMDD(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const v = value.trim();
    if (!v) return null;

    // already yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

    // dd/mm/yyyy or dd-mm-yyyy -> convert to yyyy-mm-dd
    const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
      const dd = String(m[1]).padStart(2, "0");
      const mm = String(m[2]).padStart(2, "0");
      const yy = m[3];
      return `${yy}-${mm}-${dd}`;
    }
  }

  // Date object
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Excel serial number
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = value * 24 * 60 * 60 * 1000;
    const dt = new Date(excelEpoch.getTime() + ms);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // try parse string/date-like
  const dt = new Date(value);
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * POST /api/insurance-policies
 * Required: customer_name, vehicle_no, start_date, phone
 * expiry_date can be omitted (trigger will calculate)
 */
exports.createPolicy = async (req, res) => {
  try {
    const {
      policy_no,
      customer_name,
      vehicle_no,
      model_name,
      company,
      start_date,
      premium,
      phone,
    } = req.body;

    const phoneClean = normalizePhone(phone);
    if (!customer_name) return res.status(400).json({ success: false, message: "customer_name is required" });
    if (!vehicle_no) return res.status(400).json({ success: false, message: "vehicle_no is required" });
    if (!start_date) return res.status(400).json({ success: false, message: "start_date is required" });
    if (!isValidPhone10(phoneClean)) return res.status(400).json({ success: false, message: "phone must be 10 digits" });

    await db.query(
      `INSERT INTO insurance_policies
        (policy_no, customer_name, vehicle_no, model_name, company, phone, start_date, expiry_date, premium)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        policy_no || null,
        customer_name,
        vehicle_no,
        model_name || null,
        company || null,
        phoneClean,
        start_date,
        premium || null,
      ]
    );

    return res.json({ success: true, message: "Insurance policy added" });
  } catch (err) {
    console.error("createPolicy error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/insurance-policies/renew
 * Renew = update start_date (trigger recalculates expiry)
 */
exports.renewPolicy = async (req, res) => {
  try {
    const { id } = req.params; // if you are not using :id, keep as you already do
    const { start_date, premium, phone, customer_name, vehicle_no } = req.body;

    const phoneClean = normalizePhone(phone);
    if (!customer_name) return res.status(400).json({ success: false, message: "customer_name is required" });
    if (!vehicle_no) return res.status(400).json({ success: false, message: "vehicle_no is required" });
    if (!start_date) return res.status(400).json({ success: false, message: "start_date is required" });
    if (!isValidPhone10(phoneClean)) return res.status(400).json({ success: false, message: "phone must be 10 digits" });

    await db.query(
      `UPDATE insurance_policies
       SET customer_name = ?,
           vehicle_no = ?,
           phone = ?,
           start_date = ?,
           expiry_date = NULL,
           premium = ?
       WHERE id = ?`,
      [customer_name, vehicle_no, phoneClean, start_date, premium || null, id]
    );

    return res.json({ success: true, message: "Policy renewed" });
  } catch (err) {
    console.error("renewPolicy error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/insurance-policies/export
 */
exports.exportPolicies = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT policy_no, customer_name, vehicle_no, model_name, company, phone, start_date, expiry_date, premium
       FROM insurance_policies
       ORDER BY expiry_date ASC`
    );

    const header = [
      "policy_no",
      "customer_name",
      "vehicle_no",
      "model_name",
      "company",
      "phone",
      "start_date",
      "expiry_date",
      "premium",
    ];

    const csvLines = [
      header.join(","),
      ...rows.map((r) =>
        header
          .map((k) => {
            const val = r[k] ?? "";
            const s = String(val).replace(/"/g, '""');
            return `"${s}"`;
          })
          .join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=insurance_policies.csv");
    return res.send(csvLines.join("\n"));
  } catch (err) {
    console.error("exportPolicies error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/insurance-policies/bulk-import
 * JSON body:
 * { rows: [ {policy_no, customer_name, vehicle_no, model_name, company, phone, start_date, expiry_date, premium}, ... ] }
 */
exports.bulkImportPolicies = async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) {
      return res.status(400).json({ success: false, message: "No rows provided" });
    }

    const values = [];
    for (const r of rows) {
      const policy_no = (r.policy_no ?? r.policy_number ?? "").toString().trim() || null;
      const customer_name = (r.customer_name ?? "").toString().trim();
      const vehicle_no = (r.vehicle_no ?? r.vehicle ?? r.vehicle_number ?? "").toString().trim();
      const model_name = (r.model_name ?? r.model ?? "").toString().trim() || null;
      const company = (r.company ?? "").toString().trim() || null;
      const phoneClean = normalizePhone(r.phone ?? r.mobile ?? r.mobile_number ?? "");
      const start_date = (r.start_date ?? "").toString().trim();
      const expiry_date = (r.expiry_date ?? "").toString().trim() || null;
      const premium = r.premium === "" || r.premium == null ? null : Number(r.premium);

      if (!customer_name || !vehicle_no || !start_date || !isValidPhone10(phoneClean)) continue;

      values.push([
        policy_no,
        customer_name,
        vehicle_no,
        model_name,
        company,
        phoneClean,
        start_date,
        expiry_date || null,
        premium,
      ]);
    }

    if (!values.length) {
      return res.status(400).json({
        success: false,
        message: "All rows invalid (missing fields / phone must be 10 digits / start_date required)",
      });
    }

    await db.query(
      `
      INSERT INTO insurance_policies
        (policy_no, customer_name, vehicle_no, model_name, company, phone, start_date, expiry_date, premium)
      VALUES ?
      `,
      [values]
    );

    return res.json({ success: true, inserted: values.length });
  } catch (err) {
    console.error("bulkImportPolicies error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/insurance-policies/import
 * form-data: file (.xlsx/.xls)
 * Columns expected:
 * policy_no, customer_name, vehicle_no, model_name, company, phone, start_date, expiry_date, premium
 */
exports.importPoliciesExcel = async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Excel file is required (form-data: file)" });

    filePath = req.file.path;

    const workbook = XLSX.readFile(filePath, { cellDates: true }); // ✅ important
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: "Excel has no data rows" });
    }

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    await db.query("START TRANSACTION");

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      const policy_no = (r.policy_no ?? r.policy_number ?? "").toString().trim() || null;
      const customer_name = (r.customer_name ?? "").toString().trim();
      const vehicle_no = (r.vehicle_no ?? r.vehicle ?? r.vehicle_number ?? "").toString().trim();
      const model_name = (r.model_name ?? r.model ?? "").toString().trim() || null;
      const company = (r.company ?? "").toString().trim() || null;
      const phoneClean = normalizePhone(r.phone ?? r.mobile ?? r.mobile_number ?? "");
      const start_date = toYYYYMMDD(r.start_date);
      const expiry_date = toYYYYMMDD(r.expiry_date);
      const premium = r.premium === "" || r.premium == null ? null : Number(r.premium);

      if (!customer_name || !vehicle_no || !start_date || !isValidPhone10(phoneClean)) {
        skipped++;
        errors.push({
          row: i + 2,
          reason: !customer_name
            ? "customer_name missing"
            : !vehicle_no
            ? "vehicle_no missing"
            : !start_date
            ? "start_date invalid (use YYYY-MM-DD in Excel)"
            : "phone must be 10 digits",
        });
        continue;
      }

      await db.query(
        `INSERT INTO insurance_policies
         (policy_no, customer_name, vehicle_no, model_name, company, phone, start_date, expiry_date, premium)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          policy_no,
          customer_name,
          vehicle_no,
          model_name,
          company,
          phoneClean,
          start_date,
          expiry_date || null,
          premium,
        ]
      );

      inserted++;
    }

    await db.query("COMMIT");

    return res.json({
      success: true,
      message: "Import completed",
      inserted,
      skipped,
      errors: errors.slice(0, 50),
    });
  } catch (err) {
    try {
      await db.query("ROLLBACK");
    } catch (_) {}
    console.error("importPoliciesExcel error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (filePath) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
    }
  }
};
