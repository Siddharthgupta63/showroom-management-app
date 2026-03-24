const db = require("../db");

function clampInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}
function normalizePolicyStatus(v) {
  const s = String(v || "").trim().toLowerCase();
  return s === "expired" ? "expired" : "running";
}
function boolFromAny(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}
function publicUploadPath(reqFile) {
  if (!reqFile?.path) return null;
  const normalized = String(reqFile.path).replace(/\\/g, "/");
  const idx = normalized.indexOf("/uploads/");
  return idx >= 0 ? normalized.slice(idx) : `/uploads/${reqFile.filename}`;
}
function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function csvCell(v) {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}
function buildDashboardWhere({ search, renewalType, company, from, to, insuranceStatus }) {
  const where = [];
  const params = [];

  if (search) {
    const q = `%${search}%`;
    where.push(`(
      CAST(renewal_id AS CHAR) LIKE ? OR
      CAST(sale_id AS CHAR) LIKE ? OR
      IFNULL(customer_name,'') LIKE ? OR
      IFNULL(phone,'') LIKE ? OR
      IFNULL(model_name,'') LIKE ? OR
      IFNULL(variant_name,'') LIKE ? OR
      IFNULL(company,'') LIKE ? OR
      IFNULL(policy_number,'') LIKE ? OR
      IFNULL(invoice_number,'') LIKE ? OR
      IFNULL(notes,'') LIKE ?
    )`);
    params.push(q, q, q, q, q, q, q, q, q, q);
  }

  if (renewalType && renewalType !== "all") {
    where.push("renewal_type = ?");
    params.push(renewalType);
  }

  if (company && company !== "all") {
    where.push("company = ?");
    params.push(company);
  }

  if (from) {
    where.push("renewal_date >= ?");
    params.push(from);
  }

  if (to) {
    where.push("renewal_date <= ?");
    params.push(to);
  }

  if (insuranceStatus && insuranceStatus !== "all") {
    where.push("insurance_status = ?");
    params.push(insuranceStatus);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

exports.createRenewal = async (req, res) => {
  try {
    const sale_id = Number(req.params.sale_id);
    const uploaded_by = req.user?.id || null;

    const {
      renewal_type = "insurance",
      company = null,
      policy_number = null,
      model_name = null,
      variant_name = null,
      invoice_number = null,
      premium_amount = 0,
      survey_charge = null,
      cpa_included = 0,
      policy_status = "running",
      renewal_date = null,
      notes = null,
    } = req.body;

    if (!sale_id) {
      return res.status(400).json({ success: false, message: "Invalid sale_id" });
    }
    if (!renewal_date) {
      return res.status(400).json({ success: false, message: "renewal_date is required" });
    }

    const status = normalizePolicyStatus(policy_status);
    const inspectionRequired = status === "expired" ? 1 : 0;
    const inspectionPhoto = publicUploadPath(req.file);

    if (status === "expired" && !inspectionPhoto) {
      return res.status(400).json({
        success: false,
        message: "Inspection photo is required when policy status is expired",
      });
    }

    const [saleRows] = await db.query("SELECT id FROM sales WHERE id = ? LIMIT 1", [sale_id]);
    if (!saleRows.length) {
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    const [result] = await db.query(
      `
      INSERT INTO renewals
        (sale_id, renewal_type, company, policy_number, model_name, variant_name,
         invoice_number, premium_amount, survey_charge, cpa_included, policy_status,
         inspection_required, inspection_photo, renewal_date, renewal_uploaded_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        sale_id,
        renewal_type,
        company,
        policy_number,
        model_name,
        variant_name,
        invoice_number,
        premium_amount || 0,
        survey_charge || null,
        boolFromAny(cpa_included) ? 1 : 0,
        status,
        inspectionRequired,
        inspectionPhoto,
        renewal_date,
        uploaded_by,
        notes,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Renewal created",
      renewalId: result.insertId,
    });
  } catch (err) {
    console.error("createRenewal error:", err);
    return res.status(500).json({ success: false, message: err.message || "Create failed" });
  }
};

exports.getRenewalDashboard = async (req, res) => {
  try {
    const page = clampInt(req.query.page, 1, 1, 1000000);
    const pageSize = clampInt(req.query.pageSize, 10, 1, 100);
    const offset = (page - 1) * pageSize;

    const search = String(req.query.search || "").trim();
    const renewalType = String(req.query.renewalType || "all").trim();
    const company = String(req.query.company || "all").trim();
    const from = String(req.query.from || "").trim() || null;
    const to = String(req.query.to || "").trim() || null;
    const insuranceStatus = String(req.query.insuranceStatus || "all").trim();

    const { whereSql, params } = buildDashboardWhere({
      search,
      renewalType,
      company,
      from,
      to,
      insuranceStatus,
    });

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM renewals_dashboard_view ${whereSql}`,
      params
    );

    const [[summaryRow]] = await db.query(
      `
      SELECT
        COUNT(*) AS all_count,
        SUM(CASE WHEN renewal_type = 'insurance' THEN 1 ELSE 0 END) AS insurance_count,
        SUM(CASE WHEN renewal_type = 'rc' THEN 1 ELSE 0 END) AS rc_count,
        SUM(CASE WHEN renewal_type = 'both' THEN 1 ELSE 0 END) AS both_count,
        COALESCE(SUM(premium_amount), 0) AS premium_total
      FROM renewals_dashboard_view
      ${whereSql}
      `,
      params
    );

    const [rows] = await db.query(
      `SELECT * FROM renewals_dashboard_view ${whereSql} ORDER BY renewal_date DESC, renewal_id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return res.json({
      success: true,
      data: rows,
      page,
      pageSize,
      total: Number(countRow?.total || 0),
      totalPages: Math.max(1, Math.ceil(Number(countRow?.total || 0) / pageSize)),
      summary: {
        all: Number(summaryRow?.all_count || 0),
        insurance: Number(summaryRow?.insurance_count || 0),
        rc: Number(summaryRow?.rc_count || 0),
        both: Number(summaryRow?.both_count || 0),
        premiumTotal: Number(summaryRow?.premium_total || 0),
      },
    });
  } catch (err) {
    console.error("getRenewalDashboard error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to load renewal dashboard",
    });
  }
};

exports.exportRenewalDashboard = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const renewalType = String(req.query.renewalType || "all").trim();
    const company = String(req.query.company || "all").trim();
    const from = String(req.query.from || "").trim() || null;
    const to = String(req.query.to || "").trim() || null;
    const insuranceStatus = String(req.query.insuranceStatus || "all").trim();

    const { whereSql, params } = buildDashboardWhere({
      search,
      renewalType,
      company,
      from,
      to,
      insuranceStatus,
    });

    const [rows] = await db.query(
      `
      SELECT
        renewal_id,
        sale_id,
        customer_name,
        phone,
        model_name,
        variant_name,
        renewal_type,
        company,
        policy_number,
        invoice_number,
        premium_amount,
        survey_charge,
        cpa_included,
        policy_status,
        inspection_required,
        inspection_photo,
        renewal_date,
        renewed_by_name,
        insurance_start_date,
        insurance_expiry_date,
        days_from_expiry,
        insurance_status,
        notes
      FROM renewals_dashboard_view
      ${whereSql}
      ORDER BY renewal_date DESC, renewal_id DESC
      `,
      params
    );

    const header = [
      "renewal_id",
      "sale_id",
      "customer_name",
      "phone",
      "model_name",
      "variant_name",
      "renewal_type",
      "company",
      "policy_number",
      "invoice_number",
      "premium_amount",
      "survey_charge",
      "cpa_included",
      "policy_status",
      "inspection_required",
      "inspection_photo",
      "renewal_date",
      "renewed_by_name",
      "insurance_start_date",
      "insurance_expiry_date",
      "days_from_expiry",
      "insurance_status",
      "notes",
    ];

    const csvLines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.renewal_id,
          r.sale_id,
          r.customer_name,
          r.phone,
          r.model_name,
          r.variant_name,
          r.renewal_type,
          r.company,
          r.policy_number,
          r.invoice_number,
          r.premium_amount,
          r.survey_charge,
          r.cpa_included,
          r.policy_status,
          r.inspection_required,
          r.inspection_photo,
          fmtDate(r.renewal_date),
          r.renewed_by_name,
          fmtDate(r.insurance_start_date),
          fmtDate(r.insurance_expiry_date),
          r.days_from_expiry,
          r.insurance_status,
          r.notes,
        ].map(csvCell).join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=renewals_dashboard.csv");
    return res.send(csvLines.join("\n"));
  } catch (err) {
    console.error("exportRenewalDashboard error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Export failed",
    });
  }
};