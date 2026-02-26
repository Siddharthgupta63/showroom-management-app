// backend/controllers/pipelineController.js
const db = require("../db");

/**
 * Pipeline list with SERVER-SIDE row visibility.
 * Owner/Admin/Manager: all rows
 * sales: only pending insurance
 * insurance: pending insurance OR expiring within 10 days OR expired
 * vahan: vahan missing OR insurance_done=0
 * hsrp: hsrp missing
 * rc: rc missing
 */
exports.listPipeline = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const q = String(req.query.q || "").trim();

    const params = [];
    let where = "WHERE 1=1";

    // Search
    if (q) {
      const like = `%${q}%`;
      const maybeId = Number(q);

      where += `
        AND (
          s.customer_name LIKE ?
          OR s.mobile_number LIKE ?
          OR s.chassis_number LIKE ?
          OR s.engine_number LIKE ?
          OR s.invoice_number LIKE ?
          OR i.policy_number LIKE ?
          OR i.vehicle_no LIKE ?
          OR i.phone LIKE ?
          ${Number.isFinite(maybeId) ? "OR s.id = ?" : ""}
        )
      `;

      params.push(like, like, like, like, like, like, like, like);
      if (Number.isFinite(maybeId)) params.push(maybeId);
    }

    // 🔒 Row visibility rules (server-side)
    if (role === "sales") {
      where += " AND i.id IS NULL";
    } else if (role === "insurance") {
      // include: pending + expiring soon + expired
      where +=
        " AND (i.id IS NULL OR i.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 10 DAY))";
    } else if (role === "vahan") {
      where += " AND (v.id IS NULL OR v.insurance_done = 0)";
    } else if (role === "hsrp") {
      where += " AND (h.id IS NULL)";
    } else if (role === "rc") {
      where += " AND (r.id IS NULL)";
    }
    // owner/admin/manager => no extra where

    const [rows] = await db.query(
      `
      SELECT
        s.id AS sale_id,
        s.customer_name,
        s.mobile_number,
        s.vehicle_make,
        s.vehicle_model,
        s.chassis_number,
        s.engine_number,
        s.invoice_number,
        s.sale_date,
        s.sale_price,
        s.rc_required,

        -- insurance (latest by max(id) per sale_id; OK for now)
        i.id AS insurance_id,
        i.company AS insurance_company,
        i.policy_number,
        i.vehicle_no,
        i.phone AS insurance_phone,
        i.start_date AS insurance_start_date,
        i.expiry_date AS insurance_expiry_date,

        -- vahan
        v.id AS vahan_id,
        v.insurance_done,
        v.hsrp_done,
        v.rc_done,

        -- hsrp
        h.id AS hsrp_id,
        COALESCE(h.hsrp_required, 0) AS hsrp_required,
        h.hsrp_number,
        h.hsrp_issued_date,

        -- rc
        r.id AS rc_id,
        r.rc_number,
        r.rc_issued_date

      FROM sales s

      LEFT JOIN (
        SELECT x.*
        FROM insurance x
        INNER JOIN (
          SELECT sale_id, MAX(id) AS max_id
          FROM insurance
          GROUP BY sale_id
        ) t ON t.max_id = x.id
      ) i ON i.sale_id = s.id

      LEFT JOIN vahan v ON v.sale_id = s.id

      LEFT JOIN (
        SELECT x.*
        FROM hsrp x
        INNER JOIN (
          SELECT sale_id, MAX(id) AS max_id
          FROM hsrp
          GROUP BY sale_id
        ) t ON t.max_id = x.id
      ) h ON h.sale_id = s.id

      LEFT JOIN (
        SELECT x.*
        FROM rc x
        INNER JOIN (
          SELECT sale_id, MAX(id) AS max_id
          FROM rc
          GROUP BY sale_id
        ) t ON t.max_id = x.id
      ) r ON r.sale_id = s.id

      ${where}
      ORDER BY s.id DESC
      LIMIT 500
      `,
      params
    );

    const data = rows.map((x) => {
      const insurance = x.insurance_id ? "done" : "pending";
      const vahan = x.vahan_id ? "done" : "pending";

      const hsrpReq = Number(x.hsrp_required ?? 0) === 1;
      const hsrp = hsrpReq ? (x.hsrp_number ? "done" : "pending") : "na";

      const rcReq = Number(x.rc_required ?? 0) === 1;
      const rc = rcReq ? (x.rc_number ? "done" : "pending") : "na";

      // ✅ RTO logic improvement: done only when RC exists (if RC required)
      const rto = rcReq ? (x.rc_number ? "done" : "pending") : "na";

      return {
        sale_id: x.sale_id,
        customer_name: x.customer_name,
        mobile: x.mobile_number || x.insurance_phone || "-",
        chassis_number: x.chassis_number || "-",
        engine_number: x.engine_number || "-",
        invoice_number: x.invoice_number || "-",
        vehicle_make: x.vehicle_make || "-",
        vehicle_model: x.vehicle_model || "-",
        sale_date: x.sale_date,

        stages: {
          sale: "done",
          insurance,
          vahan,
          hsrp,
          rc,
          rto,
        },

        details: {
          sale_price: x.sale_price,

          insurance_company: x.insurance_company,
          policy_number: x.policy_number,
          vehicle_no: x.vehicle_no,
          insurance_start_date: x.insurance_start_date,
          insurance_expiry_date: x.insurance_expiry_date,

          hsrp_number: x.hsrp_number,
          hsrp_issued_date: x.hsrp_issued_date,

          rc_number: x.rc_number,
          rc_issued_date: x.rc_issued_date,
        },
      };
    });

    return res.json({ success: true, data });
  } catch (e) {
    console.error("pipeline list error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.pipelineKpis = async (req, res) => {
  try {
    // KPI counts (global)
    const [[kpis]] = await db.query(`
      SELECT
        SUM(CASE WHEN i.sale_id IS NULL THEN 1 ELSE 0 END) AS pending_insurance,
        SUM(CASE WHEN v.sale_id IS NULL OR v.insurance_done = 0 THEN 1 ELSE 0 END) AS pending_vahan,
        SUM(CASE WHEN h.sale_id IS NULL THEN 1 ELSE 0 END) AS pending_hsrp,
        SUM(CASE WHEN r.sale_id IS NULL THEN 1 ELSE 0 END) AS pending_rc,
        SUM(CASE WHEN i.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 10 DAY) THEN 1 ELSE 0 END) AS expiring_soon,
        SUM(CASE WHEN i.expiry_date < CURDATE() THEN 1 ELSE 0 END) AS expired
      FROM sales s
      LEFT JOIN insurance i ON i.sale_id = s.id
      LEFT JOIN vahan v ON v.sale_id = s.id
      LEFT JOIN hsrp h ON h.sale_id = s.id
      LEFT JOIN rc r ON r.sale_id = s.id
    `);

    return res.json({ success: true, data: kpis });
  } catch (e) {
    console.error("pipeline kpis error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Export filtered rows as CSV (Excel-friendly)
exports.exportPipelineCsv = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();

    // same visibility rules as listPipeline
    let where = "WHERE 1=1";
    if (role === "sales") where += " AND i.id IS NULL";
    else if (role === "insurance")
      where +=
        " AND (i.id IS NULL OR i.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 10 DAY))";
    else if (role === "vahan") where += " AND (v.id IS NULL OR v.insurance_done = 0)";
    else if (role === "hsrp") where += " AND (h.id IS NULL)";
    else if (role === "rc") where += " AND (r.id IS NULL)";

    const [rows] = await db.query(
      `
      SELECT
        s.id AS sale_id,
        s.customer_name,
        s.mobile_number,
        s.vehicle_make,
        s.vehicle_model,
        s.chassis_number,
        s.invoice_number,
        i.policy_number,
        i.company AS insurance_company,
        i.start_date AS insurance_start_date,
        i.expiry_date AS insurance_expiry_date,
        h.hsrp_number,
        r.rc_number
      FROM sales s
      LEFT JOIN insurance i ON i.sale_id = s.id
      LEFT JOIN vahan v ON v.sale_id = s.id
      LEFT JOIN hsrp h ON h.sale_id = s.id
      LEFT JOIN rc r ON r.sale_id = s.id
      ${where}
      ORDER BY s.id DESC
      `
    );

    const headers = [
      "sale_id",
      "customer_name",
      "mobile_number",
      "vehicle_make",
      "vehicle_model",
      "chassis_number",
      "invoice_number",
      "policy_number",
      "insurance_company",
      "insurance_start_date",
      "insurance_expiry_date",
      "hsrp_number",
      "rc_number",
    ];

    const esc = (v) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="pipeline_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.send(lines.join("\n"));
  } catch (e) {
    console.error("pipeline export error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
