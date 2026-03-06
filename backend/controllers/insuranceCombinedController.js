// backend/controllers/insuranceCombinedController.js
const db = require("../db");

function buildWhere({ source, search, from, to }) {
  const where = [];
  const params = [];

  // ✅ FIX: collation-safe compare for `source`
  if (source && source !== "all") {
    where.push("source COLLATE utf8mb4_0900_ai_ci = ? COLLATE utf8mb4_0900_ai_ci");
    params.push(String(source).toUpperCase()); // SALE / RENEWAL
  }

  // Date filter on START DATE
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
      IFNULL(engine_number,'') LIKE ?
    )`);
    params.push(q, q, q, q, q, q, q);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

exports.getCombinedInsurance = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 10)));
    const offset = (page - 1) * pageSize;

    const source = (req.query.source || "all").toString();
    const search = (req.query.search || "").toString().trim();
    const from = (req.query.from || "").toString().trim() || null;
    const to = (req.query.to || "").toString().trim() || null;

    const { whereSql, params } = buildWhere({ source, search, from, to });

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM insurance_combined_view ${whereSql}`,
      params
    );

    const [rows] = await db.query(
      `
      SELECT
        source,
        id,
        sale_id,
        customer_name,
        phone,
        vehicle_no,
        model_name,
        chassis_number,
        engine_number,
        company,
        policy_no,
        start_date,
        expiry_date,
        days_left,
        followup1_date, followup1_remark,
        followup2_date, followup2_remark,
        followup3_date, followup3_remark,
        CASE
          WHEN days_left < 0 THEN 'black'
          WHEN days_left BETWEEN 0 AND 3 THEN 'red'
          WHEN days_left BETWEEN 4 AND 10 THEN 'orange'
          ELSE 'green'
        END AS status_color
      FROM insurance_combined_view
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
    });
  } catch (err) {
    console.error("getCombinedInsurance error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportCombined = async (req, res) => {
  try {
    const source = (req.query.source || "all").toString();
    const search = (req.query.search || "").toString().trim();
    const from = (req.query.from || "").toString().trim() || null;
    const to = (req.query.to || "").toString().trim() || null;

    const { whereSql, params } = buildWhere({ source, search, from, to });

    const [rows] = await db.query(
      `
      SELECT
        source, policy_no, customer_name, phone, vehicle_no, model_name,
        chassis_number, engine_number, company, start_date, expiry_date, days_left,
        followup1_date, followup1_remark, followup2_date, followup2_remark, followup3_date, followup3_remark
      FROM insurance_combined_view
      ${whereSql}
      ORDER BY expiry_date ASC, id DESC
      `,
      params
    );

    const header = [
      "source","policy_no","customer_name","phone","vehicle_no","model_name",
      "chassis_number","engine_number","company","start_date","expiry_date","days_left",
      "followup1_date","followup1_remark","followup2_date","followup2_remark","followup3_date","followup3_remark"
    ];

    const csvLines = [
      header.join(","),
      ...rows.map((r) =>
        header
          .map((k) => {
            const v = r[k] ?? "";
            const s = String(v).replace(/"/g, '""');
            return `"${s}"`;
          })
          .join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=insurance_combined.csv");
    return res.send(csvLines.join("\n"));
  } catch (err) {
    console.error("exportCombined error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
