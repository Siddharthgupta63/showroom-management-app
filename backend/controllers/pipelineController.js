const db = require("../db");

/**
 * Pipeline list with SERVER-SIDE row visibility.
 * Owner/Admin/Manager: all rows
 * sales: only pending insurance
 * insurance: pending insurance OR expiring within 10 days OR expired
 * vahan: pending vahan only
 * hsrp: pending hsrp only
 * rc: pending rc only
 */

function buildLatestInsuranceJoin() {
  return `
    LEFT JOIN (
      SELECT x.*
      FROM insurance x
      INNER JOIN (
        SELECT sale_id, MAX(id) AS max_id
        FROM insurance
        GROUP BY sale_id
      ) t ON t.max_id = x.id
    ) i ON i.sale_id = s.id
  `;
}

function buildLatestVahanSubmissionJoin() {
  return `
    LEFT JOIN (
      SELECT x.*
      FROM vahan_submission x
      INNER JOIN (
        SELECT sale_id, MAX(id) AS max_id
        FROM vahan_submission
        GROUP BY sale_id
      ) t ON t.max_id = x.id
    ) vs ON vs.sale_id = s.id
  `;
}

function buildLatestHsrpJoin() {
  return `
    LEFT JOIN (
      SELECT x.*
      FROM hsrp x
      INNER JOIN (
        SELECT sale_id, MAX(id) AS max_id
        FROM hsrp
        GROUP BY sale_id
      ) t ON t.max_id = x.id
    ) h ON h.sale_id = s.id
  `;
}

function buildLatestRcJoin() {
  return `
    LEFT JOIN (
      SELECT x.*
      FROM rc x
      INNER JOIN (
        SELECT sale_id, MAX(id) AS max_id
        FROM rc
        GROUP BY sale_id
      ) t ON t.max_id = x.id
    ) r ON r.sale_id = s.id
  `;
}

function getInsuranceDoneExpr() {
  return `
    (
      i.id IS NOT NULL
      OR COALESCE(s.insurance_number, '') <> ''
      OR COALESCE(s.insurance_company, '') <> ''
    )
  `;
}

function getPendingVahanExpr() {
  return `
    (
      ${getInsuranceDoneExpr()}
      AND (vs.application_number IS NULL OR vs.application_number = '')
    )
  `;
}

function getPendingHsrpExpr() {
  return `
    (
      vs.application_number IS NOT NULL
      AND vs.application_number <> ''
      AND COALESCE(vs.payment_done, 0) = 1
      AND (
        h.id IS NULL
        OR COALESCE(h.hsrp_number, '') = ''
      )
    )
  `;
}

function getPendingRcExpr() {
  return `
    (
      COALESCE(s.rc_required, 0) = 1
      AND (
        h.id IS NOT NULL
        OR COALESCE(h.hsrp_number, '') <> ''
      )
      AND (
        r.id IS NULL
        OR COALESCE(r.rc_number, '') = ''
      )
    )
  `;
}

function getDueRenewalExpr() {
  return `
    (
      i.expiry_date IS NOT NULL
      AND i.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 10 DAY)
    )
  `;
}

function getExpiredExpr() {
  return `
    (
      i.expiry_date IS NOT NULL
      AND i.expiry_date < CURDATE()
    )
  `;
}

function mapStageState(x) {
  const insuranceDone =
    Number(x.insurance_done_calc || 0) === 1;

  const hasApplication =
    !!String(x.application_number || "").trim();

  const paymentDone =
    Number(x.payment_done || 0) === 1;

  const hsrpRequired =
    Number(x.hsrp_required || 0) === 1;

  const hasHsrp =
    !!String(x.hsrp_number || "").trim();

  const rcRequired =
    Number(x.rc_required || 0) === 1;

  const hasRc =
    !!String(x.rc_number || "").trim();

  const insurance = insuranceDone ? "done" : "pending";

  let vahan = "blocked";
  if (!insuranceDone) {
    vahan = "blocked";
  } else if (hasApplication) {
    vahan = "done";
  } else {
    vahan = "pending";
  }

  let hsrp = "na";
  if (hsrpRequired) {
    if (!hasApplication || !paymentDone) {
      hsrp = "blocked";
    } else if (hasHsrp) {
      hsrp = "done";
    } else {
      hsrp = "pending";
    }
  }

  let rc = "na";
  if (rcRequired) {
    if (hsrpRequired && !hasHsrp) {
      rc = "blocked";
    } else if (hasRc) {
      rc = "done";
    } else {
      rc = "pending";
    }
  }

  // old-style simple RTO logic kept aligned with RC
  let rto = "na";
  if (rcRequired) {
    rto = hasRc ? "done" : "blocked";
  }

  return {
    insurance,
    vahan,
    hsrp,
    rc,
    rto,
  };
}

async function getPipelineRows({ role, q }) {
  const params = [];
  let where = `WHERE COALESCE(s.is_cancelled, 0) = 0`;

  if (q) {
    const like = `%${q}%`;
    const maybeId = Number(q);

    where += `
      AND (
        COALESCE(s.customer_name, '') LIKE ?
        OR COALESCE(s.mobile_number, '') LIKE ?
        OR COALESCE(s.chassis_number, '') LIKE ?
        OR COALESCE(s.engine_number, '') LIKE ?
        OR COALESCE(s.invoice_number, '') LIKE ?
        OR COALESCE(i.policy_number, '') LIKE ?
        OR COALESCE(i.vehicle_no, '') LIKE ?
        ${Number.isFinite(maybeId) ? "OR s.id = ?" : ""}
      )
    `;
    params.push(like, like, like, like, like, like, like);
    if (Number.isFinite(maybeId)) params.push(maybeId);
  }

  // 🔒 server-side visibility
  if (role === "sales") {
    where += ` AND NOT ${getInsuranceDoneExpr()} `;
  } else if (role === "insurance") {
    where += ` AND (NOT ${getInsuranceDoneExpr()} OR ${getDueRenewalExpr()} OR ${getExpiredExpr()})`;
  } else if (role === "vahan") {
    where += ` AND ${getPendingVahanExpr()} `;
  } else if (role === "hsrp") {
    where += ` AND ${getPendingHsrpExpr()} `;
  } else if (role === "rc") {
    where += ` AND ${getPendingRcExpr()} `;
  }

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

      CASE
        WHEN i.id IS NOT NULL
          OR COALESCE(s.insurance_number, '') <> ''
          OR COALESCE(s.insurance_company, '') <> ''
        THEN 1 ELSE 0
      END AS insurance_done_calc,

      i.id AS insurance_id,
      i.company AS insurance_company_latest,
      i.policy_number,
      i.vehicle_no,
      i.start_date AS insurance_start_date,
      i.expiry_date AS insurance_expiry_date,

      v.id AS vahan_id,
      v.current_status AS vahan_current_status,
      v.insurance_done,
      v.hsrp_done,
      v.rc_done,

      vs.id AS vahan_submission_id,
      vs.application_number,
      vs.vahan_fill_date,
      vs.payment_done,
      vs.vahan_payment_date,
      vs.rto_number,

      h.id AS hsrp_id,
      COALESCE(h.hsrp_required, 0) AS hsrp_required,
      h.hsrp_number,
      h.hsrp_issued_date,

      r.id AS rc_id,
      r.rc_number,
      r.rc_issued_date

    FROM sales s
    ${buildLatestInsuranceJoin()}
    LEFT JOIN vahan v ON v.sale_id = s.id
    ${buildLatestVahanSubmissionJoin()}
    ${buildLatestHsrpJoin()}
    ${buildLatestRcJoin()}
    ${where}
    ORDER BY s.id DESC
    LIMIT 500
    `,
    params
  );

  return rows.map((x) => {
    const stages = mapStageState(x);

    return {
      sale_id: x.sale_id,
      customer_name: x.customer_name,
      mobile: x.mobile_number || "-",
      chassis_number: x.chassis_number || "-",
      engine_number: x.engine_number || "-",
      invoice_number: x.invoice_number || "-",
      vehicle_make: x.vehicle_make || "-",
      vehicle_model: x.vehicle_model || "-",
      sale_date: x.sale_date,

      stages: {
        sale: "done",
        insurance: stages.insurance,
        vahan: stages.vahan,
        hsrp: stages.hsrp,
        rc: stages.rc,
        rto: stages.rto,
      },

      details: {
        sale_price: x.sale_price,
        insurance_company: x.insurance_company_latest || x.insurance_company || null,
        policy_number: x.policy_number,
        vehicle_no: x.vehicle_no,
        insurance_start_date: x.insurance_start_date,
        insurance_expiry_date: x.insurance_expiry_date,

        application_number: x.application_number,
        vahan_fill_date: x.vahan_fill_date,
        vahan_payment_date: x.vahan_payment_date,
        rto_number: x.rto_number,

        hsrp_number: x.hsrp_number,
        hsrp_issued_date: x.hsrp_issued_date,

        rc_number: x.rc_number,
        rc_issued_date: x.rc_issued_date,
      },
    };
  });
}

exports.listPipeline = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const q = String(req.query.q || "").trim();

    const data = await getPipelineRows({ role, q });

    return res.json({ success: true, data });
  } catch (e) {
    console.error("pipeline list error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.pipelineKpis = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();

    const rows = await getPipelineRows({ role, q: "" });

    let pending_insurance = 0;
    let pending_vahan = 0;
    let pending_hsrp = 0;
    let pending_rc = 0;
    let expiring_soon = 0;
    let expired = 0;

    for (const row of rows) {
      if (row.stages.insurance === "pending") pending_insurance += 1;
      if (row.stages.vahan === "pending") pending_vahan += 1;
      if (row.stages.hsrp === "pending") pending_hsrp += 1;
      if (row.stages.rc === "pending") pending_rc += 1;

      const exp = row.details?.insurance_expiry_date;
      if (exp) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dt = new Date(exp);
        dt.setHours(0, 0, 0, 0);

        if (!Number.isNaN(dt.getTime())) {
          const diff = Math.floor((dt.getTime() - today.getTime()) / 86400000);
          if (diff >= 0 && diff <= 10) expiring_soon += 1;
          if (diff < 0) expired += 1;
        }
      }
    }

    return res.json({
      success: true,
      data: {
        pending_insurance,
        pending_vahan,
        pending_hsrp,
        pending_rc,
        expiring_soon,
        expired,
      },
    });
  } catch (e) {
    console.error("pipeline kpis error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Export filtered rows as CSV (Excel-friendly)
exports.exportPipelineCsv = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const rows = await getPipelineRows({ role, q: "" });

    const headers = [
      "sale_id",
      "customer_name",
      "mobile",
      "vehicle_make",
      "vehicle_model",
      "chassis_number",
      "engine_number",
      "invoice_number",
      "policy_number",
      "insurance_company",
      "insurance_start_date",
      "insurance_expiry_date",
      "application_number",
      "vahan_fill_date",
      "vahan_payment_date",
      "rto_number",
      "hsrp_number",
      "rc_number",
      "insurance_stage",
      "vahan_stage",
      "hsrp_stage",
      "rc_stage",
      "rto_stage",
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
      ...rows.map((r) =>
        [
          r.sale_id,
          r.customer_name,
          r.mobile,
          r.vehicle_make,
          r.vehicle_model,
          r.chassis_number,
          r.engine_number,
          r.invoice_number,
          r.details?.policy_number,
          r.details?.insurance_company,
          r.details?.insurance_start_date,
          r.details?.insurance_expiry_date,
          r.details?.application_number,
          r.details?.vahan_fill_date,
          r.details?.vahan_payment_date,
          r.details?.rto_number,
          r.details?.hsrp_number,
          r.details?.rc_number,
          r.stages?.insurance,
          r.stages?.vahan,
          r.stages?.hsrp,
          r.stages?.rc,
          r.stages?.rto,
        ]
          .map(esc)
          .join(",")
      ),
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