const db = require("../db");

/**
 * Pipeline list with SERVER-SIDE row visibility.
 * Owner/Admin/Manager: all rows
 * sales: only pending insurance
 * insurance: pending insurance OR expiring within 10 days OR expired
 * vahan: pending vahan only
 * hsrp: pending hsrp only
 * rc: pending rc only
 *
 * Updated logic:
 * - After VAHAN payment, HSRP and RC run in parallel
 * - RC no longer waits for HSRP fitment
 * - HSRP flow:
 *   Pending Order -> Ordered -> Plate Received / Fitment Pending -> Done
 * - RC flow:
 *   File Preparation Pending -> File Ready -> Sent To Agent -> RC Received -> Delivered
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

function buildLatestHsrpFitmentJoin() {
  return `
    LEFT JOIN (
      SELECT x.*
      FROM hsrp_fitment x
      INNER JOIN (
        SELECT sale_id, MAX(id) AS max_id
        FROM hsrp_fitment
        GROUP BY sale_id
      ) t ON t.max_id = x.id
    ) hf ON hf.sale_id = s.id
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

function buildLatestRcStatusJoin() {
  return `
    LEFT JOIN (
      SELECT x.*
      FROM rc_status x
      INNER JOIN (
        SELECT sale_id, MAX(id) AS max_id
        FROM rc_status
        GROUP BY sale_id
      ) t ON t.max_id = x.id
    ) rs ON rs.sale_id = s.id
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
      AND (
        vs.id IS NULL
        OR COALESCE(vs.application_number, '') = ''
      )
    )
  `;
}

/**
 * HSRP pending for HSRP role:
 * - vahan payment done
 * - hsrp required
 * - not fully installed yet
 */
function getPendingHsrpExpr() {
  return `
    (
      COALESCE(vs.payment_done, 0) = 1
      AND COALESCE(h.hsrp_required, 0) = 1
      AND COALESCE(hf.hsrp_installed, 0) = 0
    )
  `;
}

/**
 * RC pending for RC role:
 * - vahan payment done
 * - rc required
 * - rc not delivered yet
 *
 * This is the new parallel logic.
 * RC does NOT wait for HSRP fitment.
 */
function getPendingRcExpr() {
  return `
    (
      COALESCE(vs.payment_done, 0) = 1
      AND COALESCE(s.rc_required, 0) = 1
      AND COALESCE(rs.rc_card_delivered, 0) = 0
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
  const insuranceDone = Number(x.insurance_done_calc || 0) === 1;

  const hasApplication = !!String(x.application_number || "").trim();
  const paymentDone = Number(x.payment_done || 0) === 1;

  const hsrpRequired = Number(x.hsrp_required || 0) === 1;
  const hasHsrpNumber = !!String(x.hsrp_number || "").trim();
  const plateReceived = Number(x.plate_received || 0) === 1;
  const hsrpInstalled = Number(x.hsrp_installed || 0) === 1;

  const rcRequired = Number(x.rc_required || 0) === 1;
  const hasRcNumber = !!String(x.rc_number || "").trim();
  const filePrepared = Number(x.file_prepared || 0) === 1;
  const fileSentToAgent = Number(x.file_sent_to_agent || 0) === 1;
  const rcReceivedFromAgent = Number(x.rc_received_from_agent || 0) === 1;
  const rcDelivered = Number(x.rc_card_delivered || 0) === 1;

  const insurance = insuranceDone ? "done" : "pending";

  let vahan = "blocked";
  if (!insuranceDone) {
    vahan = "blocked";
  } else if (!hasApplication) {
    vahan = "pending";
  } else if (!paymentDone) {
    vahan = "pending";
  } else {
    vahan = "done";
  }

  let hsrp = "na";
  if (hsrpRequired) {
    if (!hasApplication || !paymentDone) {
      hsrp = "blocked";
    } else if (!hasHsrpNumber) {
      hsrp = "pending"; // pending order
    } else if (!plateReceived) {
      hsrp = "pending"; // ordered, waiting for plate
    } else if (!hsrpInstalled) {
      hsrp = "pending"; // plate received, fitment pending
    } else {
      hsrp = "done";
    }
  }

  let rc = "na";
  if (rcRequired) {
    if (!hasApplication || !paymentDone) {
      rc = "blocked";
    } else if (!filePrepared) {
      rc = "pending";
    } else if (!fileSentToAgent) {
      rc = "pending";
    } else if (!rcReceivedFromAgent) {
      rc = "pending";
    } else if (!rcDelivered) {
      rc = "pending";
    } else {
      rc = "done";
    }
  }

  // RTO aligned with agent / RC progress
  let rto = "na";
  if (rcRequired) {
    if (!hasApplication || !paymentDone) {
      rto = "blocked";
    } else if (!fileSentToAgent) {
      rto = "blocked";
    } else if (!rcReceivedFromAgent) {
      rto = "pending";
    } else {
      rto = "done";
    }
  }

  return {
    insurance,
    vahan,
    hsrp,
    rc,
    rto,
    extra: {
      hasRcNumber,
    },
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
        OR COALESCE(vs.application_number, '') LIKE ?
        OR COALESCE(h.hsrp_number, '') LIKE ?
        OR COALESCE(r.rc_number, '') LIKE ?
        OR COALESCE(rs.agent_name, '') LIKE ?
        ${Number.isFinite(maybeId) ? "OR s.id = ?" : ""}
      )
    `;

    params.push(
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like
    );

    if (Number.isFinite(maybeId)) params.push(maybeId);
  }

  // server-side visibility kept from old logic
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
      COALESCE(s.rc_required, 0) AS rc_required,

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
      COALESCE(vs.payment_done, 0) AS payment_done,
      vs.vahan_payment_date,
      vs.rto_number,

      h.id AS hsrp_id,
      COALESCE(h.hsrp_required, 0) AS hsrp_required,
      h.hsrp_number,
      h.hsrp_issued_date,
      COALESCE(h.plate_received, 0) AS plate_received,
      h.plate_received_date,

      hf.id AS hsrp_fitment_id,
      COALESCE(hf.hsrp_installed, 0) AS hsrp_installed,
      hf.fitment_date,

      r.id AS rc_id,
      r.rc_number,
      r.rc_issued_date,

      rs.id AS rc_status_id,
      COALESCE(rs.file_prepared, 0) AS file_prepared,
      rs.file_prepared_date,
      COALESCE(rs.file_sent_to_agent, 0) AS file_sent_to_agent,
      rs.file_sent_to_agent_date,
      rs.agent_name,
      COALESCE(rs.rc_received_from_agent, 0) AS rc_received_from_agent,
      rs.rc_received_from_agent_date,
      COALESCE(rs.rc_card_delivered, 0) AS rc_card_delivered,
      rs.rc_delivered_date

    FROM sales s
    ${buildLatestInsuranceJoin()}
    LEFT JOIN vahan v ON v.sale_id = s.id
    ${buildLatestVahanSubmissionJoin()}
    ${buildLatestHsrpJoin()}
    ${buildLatestHsrpFitmentJoin()}
    ${buildLatestRcJoin()}
    ${buildLatestRcStatusJoin()}
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
        insurance_company: x.insurance_company_latest || null,
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
        plate_received: x.plate_received,
        plate_received_date: x.plate_received_date,
        hsrp_installed: x.hsrp_installed,
        fitment_date: x.fitment_date,

        rc_number: x.rc_number,
        rc_issued_date: x.rc_issued_date,
        file_prepared: x.file_prepared,
        file_prepared_date: x.file_prepared_date,
        file_sent_to_agent: x.file_sent_to_agent,
        file_sent_to_agent_date: x.file_sent_to_agent_date,
        agent_name: x.agent_name,
        rc_received_from_agent: x.rc_received_from_agent,
        rc_received_from_agent_date: x.rc_received_from_agent_date,
        rc_card_delivered: x.rc_card_delivered,
        rc_delivered_date: x.rc_delivered_date,
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
      "plate_received_date",
      "fitment_date",
      "rc_number",
      "file_prepared_date",
      "file_sent_to_agent_date",
      "agent_name",
      "rc_received_from_agent_date",
      "rc_delivered_date",
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
          r.details?.plate_received_date,
          r.details?.fitment_date,
          r.details?.rc_number,
          r.details?.file_prepared_date,
          r.details?.file_sent_to_agent_date,
          r.details?.agent_name,
          r.details?.rc_received_from_agent_date,
          r.details?.rc_delivered_date,
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