const db = require("../db");

function normalizeStatus(status) {
  const s = String(status || "all").trim().toLowerCase();
  if (["all", "active", "expiring", "expired"].includes(s)) return s;
  return "all";
}

function buildWhere({ source, search, from, to, status }) {
  const where = [];
  const params = [];

  if (source && source !== "all") {
    where.push("t.source = ?");
    params.push(String(source).toUpperCase());
  }

  if (from) {
    where.push("t.start_date >= ?");
    params.push(from);
  }

  if (to) {
    where.push("t.start_date <= ?");
    params.push(to);
  }

  if (search) {
    const q = `%${search}%`;
    where.push(`(
      t.policy_no LIKE ? OR
      t.customer_name LIKE ? OR
      t.vehicle_no LIKE ? OR
      t.phone LIKE ? OR
      t.company LIKE ? OR
      IFNULL(t.chassis_number,'') LIKE ? OR
      IFNULL(t.engine_number,'') LIKE ? OR
      IFNULL(t.model_name,'') LIKE ?
    )`);
    params.push(q, q, q, q, q, q, q, q);
  }

  if (status && status !== "all") {
    if (status === "active") where.push("t.days_left > 10");
    if (status === "expiring") where.push("t.days_left BETWEEN 0 AND 10");
    if (status === "expired") where.push("t.days_left < 0");
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

function baseUnionSql() {
  return `
    SELECT *
    FROM (
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
        followup1_date,
        followup1_remark,
        followup2_date,
        followup2_remark,
        followup3_date,
        followup3_remark,
        cpa_number,
        cpa_included,
        insurance_broker,
        agent,
        agent_name,
        broker,
        premium_amount,
        premium,
        invoice_number,
        remarks,
        insurance_type,
        renewal_date,
        NULL AS uploaded_file
      FROM insurance_combined_view_v2 v
      WHERE NOT EXISTS (
        SELECT 1
        FROM insurance_policies p
        WHERE TRIM(IFNULL(p.policy_no,'')) = TRIM(IFNULL(v.policy_no,''))
          AND TRIM(IFNULL(p.vehicle_no,'')) = TRIM(IFNULL(v.vehicle_no,''))
          AND IFNULL(p.start_date,'0000-00-00') = IFNULL(v.start_date,'0000-00-00')
      )

      UNION ALL

      SELECT
        'DIRECT' AS source,
        p.id,
        NULL AS sale_id,
        p.policy_no,
        p.customer_name,
        p.phone,
        p.vehicle_no,
        p.model_name,
        cv.chassis_number,
        cv.engine_number,
        p.company,
        p.start_date,
        p.expiry_date,
        DATEDIFF(p.expiry_date, CURDATE()) AS days_left,
        p.followup1_date,
        p.followup1_remark,
        p.followup2_date,
        p.followup2_remark,
        p.followup3_date,
        p.followup3_remark,
        NULL AS cpa_number,
        p.cpa_included,
        NULL AS insurance_broker,
        NULL AS agent,
        NULL AS agent_name,
        NULL AS broker,
        p.premium AS premium_amount,
        p.premium,
        p.invoice_number,
        p.notes AS remarks,
        NULL AS insurance_type,
        NULL AS renewal_date,
        COALESCE(p.uploaded_file, p.inspection_photo) AS uploaded_file
      FROM insurance_policies p
      LEFT JOIN contact_vehicles cv ON cv.id = p.contact_vehicle_id
    ) z
  `;
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
    const status = normalizeStatus(req.query.status);

    const { whereSql, params } = buildWhere({ source, search, from, to, status });
    const { whereSql: summaryWhereSql, params: summaryParams } = buildWhere({
      source,
      search,
      from,
      to,
      status: "all",
    });

    const unionSql = baseUnionSql();

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM (${unionSql}) t ${whereSql}`,
      params
    );

    const [[summaryRow]] = await db.query(
      `
      SELECT
        COUNT(*) AS all_count,
        SUM(CASE WHEN t.days_left > 10 THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN t.days_left BETWEEN 0 AND 10 THEN 1 ELSE 0 END) AS expiring_count,
        SUM(CASE WHEN t.days_left < 0 THEN 1 ELSE 0 END) AS expired_count
      FROM (${unionSql}) t
      ${summaryWhereSql}
      `,
      summaryParams
    );

    const [rows] = await db.query(
      `
      SELECT
        t.*,
        CASE
          WHEN t.days_left < 0 THEN 'black'
          WHEN t.days_left BETWEEN 0 AND 3 THEN 'red'
          WHEN t.days_left BETWEEN 4 AND 10 THEN 'orange'
          ELSE 'green'
        END AS status_color
      FROM (${unionSql}) t
      ${whereSql}
      ORDER BY
        CASE WHEN t.days_left = 0 THEN 0 ELSE 1 END ASC,
        CASE WHEN t.days_left < 0 THEN 1 ELSE 0 END ASC,
        CASE WHEN t.days_left >= 0 THEN t.days_left ELSE 999999 END ASC,
        CASE WHEN t.days_left < 0 THEN t.days_left ELSE -999999 END DESC,
        t.expiry_date ASC,
        t.id DESC
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
      message: err.message || "Failed to load combined insurance list",
    });
  }
};

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
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

exports.exportCombined = async (req, res) => {
  try {
    const source = (req.query.source || "all").toString();
    const search = (req.query.search || "").toString().trim();
    const from = (req.query.from || "").toString().trim() || null;
    const to = (req.query.to || "").toString().trim() || null;
    const status = normalizeStatus(req.query.status);

    const { whereSql, params } = buildWhere({ source, search, from, to, status });
    const unionSql = baseUnionSql();

    const [rows] = await db.query(
      `
      SELECT
        t.source,
        t.id,
        t.sale_id,
        t.policy_no,
        t.customer_name,
        t.phone,
        t.vehicle_no,
        t.model_name,
        t.chassis_number,
        t.engine_number,
        t.company,
        t.start_date,
        t.expiry_date,
        t.days_left,
        CASE
          WHEN t.days_left < 0 THEN 'Expired'
          WHEN t.days_left BETWEEN 0 AND 10 THEN 'Expiring'
          ELSE 'Active'
        END AS status_label,
        t.cpa_included,
        t.cpa_number,
        COALESCE(t.insurance_broker, t.agent, t.agent_name, t.broker) AS insurance_broker,
        COALESCE(t.premium_amount, t.premium) AS premium_amount,
        t.invoice_number,
        t.remarks,
        t.followup1_date,
        t.followup1_remark,
        t.followup2_date,
        t.followup2_remark,
        t.followup3_date,
        t.followup3_remark,
        t.uploaded_file
      FROM (${unionSql}) t
      ${whereSql}
      ORDER BY t.expiry_date ASC, t.id DESC
      `,
      params
    );

    const header = [
      "source","id","sale_id","policy_no","customer_name","phone","vehicle_no","model_name",
      "chassis_number","engine_number","company","start_date","expiry_date","days_left",
      "status_label","cpa_included","cpa_number","insurance_broker","premium_amount",
      "invoice_number","remarks","followup1_date","followup1_remark","followup2_date",
      "followup2_remark","followup3_date","followup3_remark","uploaded_file",
    ];

    const csvLines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.source, r.id, r.sale_id, r.policy_no, r.customer_name, r.phone, r.vehicle_no,
          r.model_name, r.chassis_number, r.engine_number, r.company, fmtDate(r.start_date),
          fmtDate(r.expiry_date), r.days_left, r.status_label, r.cpa_included, r.cpa_number,
          r.insurance_broker, r.premium_amount, r.invoice_number, r.remarks,
          fmtDate(r.followup1_date), r.followup1_remark, fmtDate(r.followup2_date),
          r.followup2_remark, fmtDate(r.followup3_date), r.followup3_remark, r.uploaded_file,
        ].map(csvCell).join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=insurance_combined.csv");
    return res.send(csvLines.join("\n"));
  } catch (err) {
    console.error("exportCombined error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Export failed",
    });
  }
};