// backend/controllers/insuranceCombinedController.js
const db = require("../db");

const VIEW_NAME = "insurance_combined_view_v2";

const OPTIONAL_VIEW_COLUMNS = [
  "cpa_number",
  "cpa_included",
  "insurance_broker",
  "agent",
  "agent_name",
  "broker",
  "premium_amount",
  "premium",
  "invoice_number",
  "remarks",
  "insurance_type",
  "renewal_date",
];

async function getViewColumns(viewName) {
  const [rows] = await db.query(
    `
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
    `,
    [viewName]
  );
  return new Set(rows.map((r) => String(r.COLUMN_NAME)));
}

function buildWhere({ source, search, from, to, status }) {
  const where = [];
  const params = [];

  if (source && source !== "all") {
    where.push("source COLLATE utf8mb4_0900_ai_ci = ? COLLATE utf8mb4_0900_ai_ci");
    params.push(String(source).toUpperCase());
  }

  if (from) {
    where.push("start_date >= ?");
    params.push(from);
  }

  if (to) {
    where.push("start_date <= ?");
    params.push(to);
  }

  if (search) {
    const q = `%${search}%`;
    where.push(`(
      policy_no LIKE ? OR
      customer_name LIKE ? OR
      vehicle_no LIKE ? OR
      phone LIKE ? OR
      company LIKE ? OR
      IFNULL(chassis_number,'') LIKE ? OR
      IFNULL(engine_number,'') LIKE ? OR
      IFNULL(model_name,'') LIKE ?
    )`);
    params.push(q, q, q, q, q, q, q, q);
  }

  if (status && status !== "all") {
    if (status === "active") {
      where.push("days_left > 10");
    } else if (status === "expiring") {
      where.push("days_left BETWEEN 0 AND 10");
    } else if (status === "expired") {
      where.push("days_left < 0");
    }
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

function buildSelectColumns(existingCols) {
  const baseCols = [
    "source",
    "id",
    "sale_id",
    "policy_no",
    "customer_name",
    "phone",
    "vehicle_no",
    "model_name",
    "chassis_number",
    "engine_number",
    "company",
    "start_date",
    "expiry_date",
    "days_left",
    "followup1_date",
    "followup1_remark",
    "followup2_date",
    "followup2_remark",
    "followup3_date",
    "followup3_remark",
  ];

  const finalCols = [...baseCols];

  for (const col of OPTIONAL_VIEW_COLUMNS) {
    if (existingCols.has(col)) finalCols.push(col);
  }

  finalCols.push(`
    CASE
      WHEN days_left < 0 THEN 'black'
      WHEN days_left BETWEEN 0 AND 3 THEN 'red'
      WHEN days_left BETWEEN 4 AND 10 THEN 'orange'
      ELSE 'green'
    END AS status_color
  `);

  finalCols.push(`
    CASE
      WHEN days_left < 0 THEN 'Expired'
      WHEN days_left BETWEEN 0 AND 10 THEN 'Expiring'
      ELSE 'Active'
    END AS status_label
  `);

  return finalCols.join(",\n        ");
}

function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return s;
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

exports.getCombinedInsurance = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const allowedSizes = [10, 20, 50, 100];
    const pageSizeInput = Number(req.query.pageSize || 10);
    const pageSize = allowedSizes.includes(pageSizeInput) ? pageSizeInput : 10;
    const offset = (page - 1) * pageSize;

    const source = (req.query.source || "all").toString();
    const search = (req.query.search || "").toString().trim();
    const from = (req.query.from || "").toString().trim() || null;
    const to = (req.query.to || "").toString().trim() || null;

    const { whereSql, params } = buildWhere({
      source,
      search,
      from,
      to,
      status: "all",
    });

    const existingCols = await getViewColumns(VIEW_NAME);
    const selectCols = buildSelectColumns(existingCols);

    const [[countRow]] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM ${VIEW_NAME}
      ${whereSql}
      `,
      params
    );

    const [[summaryRow]] = await db.query(
      `
      SELECT
        COUNT(*) AS all_count,
        SUM(CASE WHEN days_left > 10 THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN days_left BETWEEN 0 AND 10 THEN 1 ELSE 0 END) AS expiring_count,
        SUM(CASE WHEN days_left < 0 THEN 1 ELSE 0 END) AS expired_count
      FROM ${VIEW_NAME}
      ${whereSql}
      `,
      params
    );

    const [rows] = await db.query(
      `
      SELECT
        ${selectCols}
      FROM ${VIEW_NAME}
      ${whereSql}
      ORDER BY
        CASE WHEN days_left = 0 THEN 0 ELSE 1 END ASC,
        CASE WHEN days_left < 0 THEN 1 ELSE 0 END ASC,
        CASE WHEN days_left >= 0 THEN days_left ELSE 999999 END ASC,
        CASE WHEN days_left < 0 THEN days_left ELSE -999999 END DESC,
        expiry_date ASC,
        id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    const total = Number(countRow?.total || 0);

    return res.json({
      success: true,
      data: rows,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      summary: {
        all: Number(summaryRow?.all_count || 0),
        active: Number(summaryRow?.active_count || 0),
        expiring: Number(summaryRow?.expiring_count || 0),
        expired: Number(summaryRow?.expired_count || 0),
      },
    });
  } catch (err) {
    console.error("getCombinedInsurance error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.exportCombined = async (req, res) => {
  try {
    const source = (req.query.source || "all").toString();
    const search = (req.query.search || "").toString().trim();
    const from = (req.query.from || "").toString().trim() || null;
    const to = (req.query.to || "").toString().trim() || null;
    const status = (req.query.status || "all").toString().trim().toLowerCase();

    const { whereSql, params } = buildWhere({ source, search, from, to, status });
    const existingCols = await getViewColumns(VIEW_NAME);

    const [rows] = await db.query(
      `
      SELECT
        source,
        id,
        sale_id,
        policy_no,
        customer_name,
        phone,
        vehicle_no,
        model_name,
        chassis_number,
        engine_number,
        company,
        start_date,
        expiry_date,
        days_left,
        CASE
          WHEN days_left < 0 THEN 'Expired'
          WHEN days_left BETWEEN 0 AND 10 THEN 'Expiring'
          ELSE 'Active'
        END AS status_label,
        ${existingCols.has("insurance_type") ? "insurance_type," : "NULL AS insurance_type,"}
        ${existingCols.has("cpa_number") ? "cpa_number," : "NULL AS cpa_number,"}
        ${existingCols.has("cpa_included") ? "cpa_included," : "NULL AS cpa_included,"}
        ${
          existingCols.has("insurance_broker")
            ? "insurance_broker,"
            : existingCols.has("agent")
            ? "agent AS insurance_broker,"
            : existingCols.has("broker")
            ? "broker AS insurance_broker,"
            : "NULL AS insurance_broker,"
        }
        ${
          existingCols.has("premium_amount")
            ? "premium_amount,"
            : existingCols.has("premium")
            ? "premium AS premium_amount,"
            : "NULL AS premium_amount,"
        }
        ${existingCols.has("invoice_number") ? "invoice_number," : "NULL AS invoice_number,"}
        ${existingCols.has("renewal_date") ? "renewal_date," : "NULL AS renewal_date,"}
        ${existingCols.has("remarks") ? "remarks," : "NULL AS remarks,"}
        followup1_date,
        followup1_remark,
        followup2_date,
        followup2_remark,
        followup3_date,
        followup3_remark
      FROM ${VIEW_NAME}
      ${whereSql}
      ORDER BY
        CASE WHEN days_left >= 0 THEN 0 ELSE 1 END ASC,
        CASE WHEN days_left >= 0 THEN days_left ELSE 999999 END ASC,
        CASE WHEN days_left < 0 THEN days_left ELSE -999999 END DESC,
        expiry_date ASC,
        id DESC
      `,
      params
    );

    const header = [
      "source",
      "insurance_id",
      "sale_id",
      "policy_no",
      "customer_name",
      "phone",
      "vehicle_no",
      "model_name",
      "chassis_number",
      "engine_number",
      "company",
      "insurance_type",
      "start_date",
      "expiry_date",
      "renewal_date",
      "days_left",
      "status",
      "cpa_included",
      "cpa_number",
      "insurance_broker",
      "premium_amount",
      "invoice_number",
      "remarks",
      "followup1_date",
      "followup1_remark",
      "followup2_date",
      "followup2_remark",
      "followup3_date",
      "followup3_remark",
    ];

    const csvLines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.source,
          r.id,
          r.sale_id,
          r.policy_no,
          r.customer_name,
          r.phone,
          r.vehicle_no,
          r.model_name,
          r.chassis_number,
          r.engine_number,
          r.company,
          r.insurance_type,
          fmtDate(r.start_date),
          fmtDate(r.expiry_date),
          fmtDate(r.renewal_date),
          r.days_left,
          r.status_label,
          r.cpa_included,
          r.cpa_number,
          r.insurance_broker,
          r.premium_amount,
          r.invoice_number,
          r.remarks,
          fmtDate(r.followup1_date),
          r.followup1_remark,
          fmtDate(r.followup2_date),
          r.followup2_remark,
          fmtDate(r.followup3_date),
          r.followup3_remark,
        ]
          .map(csvCell)
          .join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=insurance_combined.csv");
    return res.send(csvLines.join("\n"));
  } catch (err) {
    console.error("exportCombined error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};