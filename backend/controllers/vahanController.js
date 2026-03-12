// backend/controllers/vahanController.js
const db = require("../db");

function loadExcelJSOrThrow() {
  try {
    return require("exceljs");
  } catch (e) {
    const err = new Error("ExcelJS missing. Run: cd backend && npm i exceljs");
    err._isExcelMissing = true;
    throw err;
  }
}

function toInt(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function cleanText(v) {
  const s = String(v ?? "").trim();
  return s || null;
}

function yn(v) {
  if (v === true || v === 1 || v === "1" || v === "true") return 1;
  return 0;
}

function sqlDate(v) {
  if (!v) return null;

  const s = String(v).trim();
  if (!s) return null;

  // YYYY-MM-DD or ISO datetime
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  // DD/MM/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const dd = slash[1].padStart(2, "0");
    const mm = slash[2].padStart(2, "0");
    const yyyy = slash[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // DD-MM-YYYY
  const dash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dash) {
    const dd = dash[1].padStart(2, "0");
    const mm = dash[2].padStart(2, "0");
    const yyyy = dash[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function asDateOnly(v) {
  const s = sqlDate(v);
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatDateOnly(dateObj) {
  if (!dateObj || Number.isNaN(dateObj.getTime())) return null;
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todaySqlDate() {
  return formatDateOnly(new Date());
}

async function getSaleById(saleId) {
  const [rows] = await db.query(
    `
    SELECT
      s.*,
      CASE
        WHEN i.id IS NOT NULL
          OR COALESCE(s.insurance_number, '') <> ''
          OR COALESCE(s.insurance_company, '') <> ''
        THEN 1 ELSE 0
      END AS insurance_done_calc
    FROM sales s
    LEFT JOIN insurance i ON i.sale_id = s.id
    WHERE s.id = ?
    LIMIT 1
    `,
    [saleId]
  );
  return rows[0] || null;
}

async function ensureVahanRow(saleId, userId) {
  const sale = await getSaleById(saleId);
  if (!sale) {
    const err = new Error("Sale not found");
    err.status = 404;
    throw err;
  }

  await db.query(
    `
    INSERT INTO vahan
      (sale_id, insurance_done, rc_required, aadhaar_required, current_status, last_updated_by, last_updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      insurance_done = VALUES(insurance_done),
      rc_required = VALUES(rc_required),
      aadhaar_required = VALUES(aadhaar_required),
      last_updated_by = VALUES(last_updated_by),
      last_updated_at = NOW()
    `,
    [
      saleId,
      Number(sale.insurance_done_calc || 0),
      Number(sale.rc_required || 0),
      Number(sale.aadhaar_required || 0),
      Number(sale.insurance_done_calc || 0)
        ? "ready_for_vahan"
        : "pending_insurance",
      userId || null,
    ]
  );

  return sale;
}

async function computeAndSaveStatus(saleId, userId) {
  const sale = await getSaleById(saleId);
  if (!sale) {
    const err = new Error("Sale not found");
    err.status = 404;
    throw err;
  }

  const [subRows] = await db.query(
    `SELECT * FROM vahan_submission WHERE sale_id = ? ORDER BY id DESC LIMIT 1`,
    [saleId]
  );
  const sub = subRows[0] || null;

  const insuranceDone = Number(sale.insurance_done_calc || 0);
  let currentStatus = insuranceDone ? "ready_for_vahan" : "pending_insurance";
  let isCompleted = 0;

  if (sub?.application_number && !Number(sub?.payment_done || 0)) {
    currentStatus = "payment_pending";
  }

  if (Number(sub?.payment_done || 0) === 1) {
    currentStatus = "payment_done";
  }

  const [hsrpRows] = await db.query(
    `SELECT id FROM hsrp WHERE sale_id = ? LIMIT 1`,
    [saleId]
  );

  // Old logic kept:
  // after payment_done, if HSRP row exists then completed
  if (Number(sub?.payment_done || 0) === 1 && hsrpRows.length > 0) {
    currentStatus = "completed";
    isCompleted = 1;
  }

  await db.query(
    `
    UPDATE vahan
    SET
      insurance_done = ?,
      current_status = ?,
      is_completed = ?,
      last_updated_by = ?,
      last_updated_at = NOW()
    WHERE sale_id = ?
    `,
    [insuranceDone, currentStatus, isCompleted, userId || null, saleId]
  );

  return { currentStatus, isCompleted };
}

function buildTabCondition(tab) {
  switch (String(tab || "all")) {
    case "pending_fill":
      return `
        AND (vs.application_number IS NULL OR vs.application_number = '')
      `;
    case "pending_payment":
      return `
        AND vs.application_number IS NOT NULL
        AND vs.application_number <> ''
        AND COALESCE(vs.payment_done, 0) = 0
      `;
    case "paid":
      return ` AND COALESCE(vs.payment_done, 0) = 1 `;
    case "unpaid":
      return ` AND COALESCE(vs.payment_done, 0) = 0 `;
    case "completed":
      return ` AND v.current_status = 'completed' `;
    default:
      return ``;
  }
}

function latestSubmissionJoinSql() {
  return `
    LEFT JOIN (
      SELECT x.*
      FROM vahan_submission x
      INNER JOIN (
        SELECT sale_id, MAX(id) AS max_id
        FROM vahan_submission
        GROUP BY sale_id
      ) m ON m.sale_id = x.sale_id AND m.max_id = x.id
    ) vs ON vs.sale_id = s.id
  `;
}

// GET /api/vahan
exports.listVahan = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.max(1, Math.min(100, toInt(req.query.limit, 20)));
    const offset = (page - 1) * limit;

    const search = String(req.query.search || "").trim();
    const tab = String(req.query.tab || "all").trim();
    const fromDate = sqlDate(req.query.from_date);
    const toDate = sqlDate(req.query.to_date);

    let where = `
      WHERE s.is_cancelled = 0
        AND (
          i.id IS NOT NULL
          OR COALESCE(s.insurance_number, '') <> ''
          OR COALESCE(s.insurance_company, '') <> ''
        )
    `;
    const params = [];

    where += buildTabCondition(tab);

    if (fromDate) {
      where += ` AND DATE(s.sale_date) >= ? `;
      params.push(fromDate);
    }

    if (toDate) {
      where += ` AND DATE(s.sale_date) <= ? `;
      params.push(toDate);
    }

    if (search) {
      where += `
        AND (
          COALESCE(s.customer_name, '') LIKE ?
          OR COALESCE(s.mobile_number, '') LIKE ?
          OR COALESCE(s.invoice_number, '') LIKE ?
          OR COALESCE(s.chassis_number, '') LIKE ?
          OR COALESCE(s.engine_number, '') LIKE ?
          OR COALESCE(vs.application_number, '') LIKE ?
          OR COALESCE(vs.rto_number, '') LIKE ?
        )
      `;
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like, like);
    }

    const baseFrom = `
      FROM sales s
      LEFT JOIN insurance i ON i.sale_id = s.id
      LEFT JOIN vahan v ON v.sale_id = s.id
      ${latestSubmissionJoinSql()}
      ${where}
    `;

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total ${baseFrom}`,
      params
    );

    const [rows] = await db.query(
      `
      SELECT
        s.id AS sale_id,
        s.sale_date,
        s.invoice_number,
        s.customer_name,
        s.mobile_number,
        s.vehicle_make,
        s.vehicle_model,
        s.chassis_number,
        s.engine_number,
        CASE
          WHEN i.id IS NOT NULL
            OR COALESCE(s.insurance_number, '') <> ''
            OR COALESCE(s.insurance_company, '') <> ''
          THEN 1 ELSE 0
        END AS insurance_done,
        CASE
          WHEN v.current_status = 'completed' OR COALESCE(v.is_completed, 0) = 1
            THEN 'completed'
          WHEN (
            i.id IS NOT NULL
            OR COALESCE(s.insurance_number, '') <> ''
            OR COALESCE(s.insurance_company, '') <> ''
          ) AND (vs.application_number IS NULL OR vs.application_number = '')
            THEN 'ready_for_vahan'
          WHEN COALESCE(vs.payment_done, 0) = 1
            THEN 'payment_done'
          WHEN vs.application_number IS NOT NULL AND vs.application_number <> ''
            THEN 'payment_pending'
          ELSE COALESCE(v.current_status, 'pending_insurance')
        END AS current_status,
        v.is_completed,
        vs.id AS submission_id,
        vs.application_number,
        vs.vahan_fill_date,
        vs.payment_amount,
        COALESCE(vs.payment_done, 0) AS payment_done,
        vs.vahan_payment_date,
        vs.rto_number,
        COALESCE(vs.penalty_due, 0) AS penalty_due,
        vs.penalty_amount,
        vs.remarks
      ${baseFrom}
      ORDER BY s.sale_date DESC, s.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(countRows?.[0]?.total || 0),
        totalPages: Math.ceil(Number(countRows?.[0]?.total || 0) / limit),
      },
    });
  } catch (e) {
    console.error("vahan listVahan:", e);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load Vahan list" });
  }
};

// GET /api/vahan/dashboard-summary
exports.dashboardSummary = async (req, res) => {
  try {
    const fromDate = sqlDate(req.query.from_date);
    const toDate = sqlDate(req.query.to_date);

    let dateFilter = "";
    const dateParams = [];

    if (fromDate) {
      dateFilter += ` AND DATE(s.sale_date) >= ? `;
      dateParams.push(fromDate);
    }

    if (toDate) {
      dateFilter += ` AND DATE(s.sale_date) <= ? `;
      dateParams.push(toDate);
    }

    const [[pendingFillRows], [pendingPaymentRows], [paidRows], [completedRows]] =
      await Promise.all([
        db.query(
          `
          SELECT COUNT(*) AS count
          FROM sales s
          LEFT JOIN insurance i ON i.sale_id = s.id
          LEFT JOIN vahan v ON v.sale_id = s.id
          ${latestSubmissionJoinSql()}
          WHERE s.is_cancelled = 0
            AND (
              i.id IS NOT NULL
              OR COALESCE(s.insurance_number, '') <> ''
              OR COALESCE(s.insurance_company, '') <> ''
            )
            AND (vs.application_number IS NULL OR vs.application_number = '')
            ${dateFilter}
          `,
          dateParams
        ),
        db.query(
          `
          SELECT COUNT(*) AS count
          FROM sales s
          LEFT JOIN insurance i ON i.sale_id = s.id
          ${latestSubmissionJoinSql()}
          WHERE s.is_cancelled = 0
            AND (
              i.id IS NOT NULL
              OR COALESCE(s.insurance_number, '') <> ''
              OR COALESCE(s.insurance_company, '') <> ''
            )
            AND vs.application_number IS NOT NULL
            AND vs.application_number <> ''
            AND COALESCE(vs.payment_done, 0) = 0
            ${dateFilter}
          `,
          dateParams
        ),
        db.query(
          `
          SELECT COUNT(*) AS count
          FROM sales s
          LEFT JOIN insurance i ON i.sale_id = s.id
          ${latestSubmissionJoinSql()}
          WHERE s.is_cancelled = 0
            AND (
              i.id IS NOT NULL
              OR COALESCE(s.insurance_number, '') <> ''
              OR COALESCE(s.insurance_company, '') <> ''
            )
            AND COALESCE(vs.payment_done, 0) = 1
            ${dateFilter}
          `,
          dateParams
        ),
        db.query(
          `
          SELECT COUNT(*) AS count
          FROM sales s
          LEFT JOIN insurance i ON i.sale_id = s.id
          LEFT JOIN vahan v ON v.sale_id = s.id
          WHERE s.is_cancelled = 0
            AND (
              i.id IS NOT NULL
              OR COALESCE(s.insurance_number, '') <> ''
              OR COALESCE(s.insurance_company, '') <> ''
            )
            AND v.current_status = 'completed'
            ${dateFilter}
          `,
          dateParams
        ),
      ]);

    const pendingFill = Number(pendingFillRows?.[0]?.count || 0);
    const pendingPayment = Number(pendingPaymentRows?.[0]?.count || 0);
    const paid = Number(paidRows?.[0]?.count || 0);
    const completed = Number(completedRows?.[0]?.count || 0);

    return res.json({
      success: true,
      pending_fill: pendingFill,
      pending_payment: pendingPayment,
      paid,
      unpaid: pendingFill + pendingPayment,
      completed,
    });
  } catch (e) {
    console.error("vahan dashboardSummary:", e);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load dashboard summary" });
  }
};

// GET /api/vahan/export
exports.exportVahan = async (req, res) => {
  try {
    const ExcelJS = loadExcelJSOrThrow();
    const search = String(req.query.search || "").trim();
    const tab = String(req.query.tab || "all").trim();
    const fromDate = sqlDate(req.query.from_date);
    const toDate = sqlDate(req.query.to_date);

    let where = `
      WHERE s.is_cancelled = 0
        AND (
          i.id IS NOT NULL
          OR COALESCE(s.insurance_number, '') <> ''
          OR COALESCE(s.insurance_company, '') <> ''
        )
    `;
    const params = [];

    where += buildTabCondition(tab);

    if (fromDate) {
      where += ` AND DATE(s.sale_date) >= ? `;
      params.push(fromDate);
    }

    if (toDate) {
      where += ` AND DATE(s.sale_date) <= ? `;
      params.push(toDate);
    }

    if (search) {
      where += `
        AND (
          COALESCE(s.customer_name, '') LIKE ?
          OR COALESCE(s.mobile_number, '') LIKE ?
          OR COALESCE(s.invoice_number, '') LIKE ?
          OR COALESCE(s.chassis_number, '') LIKE ?
          OR COALESCE(s.engine_number, '') LIKE ?
          OR COALESCE(vs.application_number, '') LIKE ?
          OR COALESCE(vs.rto_number, '') LIKE ?
        )
      `;
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like, like);
    }

    const [rows] = await db.query(
      `
      SELECT
        s.id AS sale_id,
        s.sale_date,
        s.invoice_number,
        s.customer_name,
        s.mobile_number,
        s.vehicle_make,
        s.vehicle_model,
        s.chassis_number,
        s.engine_number,
        CASE
          WHEN i.id IS NOT NULL
            OR COALESCE(s.insurance_number, '') <> ''
            OR COALESCE(s.insurance_company, '') <> ''
          THEN 1 ELSE 0
        END AS insurance_done,
        CASE
          WHEN v.current_status = 'completed' OR COALESCE(v.is_completed, 0) = 1
            THEN 'completed'
          WHEN (
            i.id IS NOT NULL
            OR COALESCE(s.insurance_number, '') <> ''
            OR COALESCE(s.insurance_company, '') <> ''
          ) AND (vs.application_number IS NULL OR vs.application_number = '')
            THEN 'ready_for_vahan'
          WHEN COALESCE(vs.payment_done, 0) = 1
            THEN 'payment_done'
          WHEN vs.application_number IS NOT NULL AND vs.application_number <> ''
            THEN 'payment_pending'
          ELSE COALESCE(v.current_status, 'pending_insurance')
        END AS current_status,
        vs.application_number,
        vs.vahan_fill_date,
        vs.payment_amount,
        COALESCE(vs.payment_done, 0) AS payment_done,
        vs.vahan_payment_date,
        vs.rto_number,
        COALESCE(vs.penalty_due, 0) AS penalty_due,
        vs.penalty_amount,
        vs.remarks
      FROM sales s
      LEFT JOIN insurance i ON i.sale_id = s.id
      LEFT JOIN vahan v ON v.sale_id = s.id
      ${latestSubmissionJoinSql()}
      ${where}
      ORDER BY s.sale_date DESC, s.id DESC
      `,
      params
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Vahan");

    ws.columns = [
      { header: "Sale ID", key: "sale_id", width: 10 },
      { header: "Sale Date", key: "sale_date", width: 14 },
      { header: "Invoice No", key: "invoice_number", width: 18 },
      { header: "Customer Name", key: "customer_name", width: 24 },
      { header: "Mobile", key: "mobile_number", width: 16 },
      { header: "Vehicle Make", key: "vehicle_make", width: 16 },
      { header: "Vehicle Model", key: "vehicle_model", width: 24 },
      { header: "Chassis No", key: "chassis_number", width: 24 },
      { header: "Engine No", key: "engine_number", width: 24 },
      { header: "Insurance Done", key: "insurance_done", width: 14 },
      { header: "Status", key: "current_status", width: 18 },
      { header: "Application No", key: "application_number", width: 18 },
      { header: "Fill Date", key: "vahan_fill_date", width: 14 },
      { header: "Payment Amount", key: "payment_amount", width: 16 },
      { header: "Payment Done", key: "payment_done", width: 14 },
      { header: "Payment Date", key: "vahan_payment_date", width: 14 },
      { header: "RTO Number", key: "rto_number", width: 18 },
      { header: "Penalty Due", key: "penalty_due", width: 12 },
      { header: "Penalty Amount", key: "penalty_amount", width: 16 },
      { header: "Remarks", key: "remarks", width: 30 },
    ];

    rows.forEach((r) => {
      ws.addRow({
        ...r,
        insurance_done: Number(r.insurance_done || 0) ? "Yes" : "No",
        payment_done: Number(r.payment_done || 0) ? "Yes" : "No",
        penalty_due: Number(r.penalty_due || 0) ? "Yes" : "No",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="vahan_export.xlsx"'
    );
    await wb.xlsx.write(res);
    return res.end();
  } catch (e) {
    console.error("vahan exportVahan:", e);
    if (e?._isExcelMissing) {
      return res.status(500).json({ success: false, message: e.message });
    }
    return res.status(500).json({ success: false, message: "Export failed" });
  }
};

// GET /api/vahan/:sale_id
exports.getVahan = async (req, res) => {
  try {
    const saleId = toInt(req.params.sale_id);
    if (!saleId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid sale_id" });
    }

    await ensureVahanRow(saleId, req.user?.id);

    const sale = await getSaleById(saleId);
    const [vahanRows] = await db.query(
      `SELECT * FROM vahan WHERE sale_id = ? LIMIT 1`,
      [saleId]
    );
    const [subRows] = await db.query(
      `SELECT * FROM vahan_submission WHERE sale_id = ? ORDER BY id DESC LIMIT 1`,
      [saleId]
    );

    return res.json({
      success: true,
      sale,
      vahan: vahanRows[0] || null,
      submission: subRows[0] || null,
    });
  } catch (e) {
    console.error("vahan getVahan:", e);
    return res.status(e.status || 500).json({
      success: false,
      message: e.message || "Failed to load Vahan details",
    });
  }
};

// POST /api/vahan
exports.createVahan = async (req, res) => {
  try {
    const saleId = toInt(req.body.sale_id);
    if (!saleId) {
      return res
        .status(400)
        .json({ success: false, message: "sale_id is required" });
    }

    await ensureVahanRow(saleId, req.user?.id);

    const applicationNumber =
      cleanText(req.body.application_number) ||
      cleanText(req.body.application_no);

    const fillDate =
      sqlDate(req.body.vahan_fill_date) ||
      sqlDate(req.body.application_filled_date) ||
      null;

    const paymentAmount = req.body.payment_amount ?? null;

    const oldStatus = String(req.body.status || "").trim().toLowerCase();
    const oldCompletedDate = sqlDate(req.body.completed_date);

    let paymentDone = yn(req.body.payment_done);
    let paymentDate =
      sqlDate(req.body.vahan_payment_date) || sqlDate(req.body.payment_date);
    let rtoNumber = cleanText(req.body.rto_number);

    if (oldStatus === "done") {
      paymentDone = 1;
      paymentDate =
        paymentDate || oldCompletedDate || new Date().toISOString().slice(0, 10);
    }

    if (fillDate) {
      const fillDateObj = asDateOnly(fillDate);
      const todayObj = asDateOnly(todaySqlDate());
      if (!fillDateObj) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid fill date" });
      }
      if (fillDateObj > todayObj) {
        return res
          .status(400)
          .json({ success: false, message: "Fill date cannot be in the future" });
      }
    }

    if (paymentDone === 1 && paymentDate) {
      const paymentDateObj = asDateOnly(paymentDate);
      const todayObj = asDateOnly(todaySqlDate());

      if (!paymentDateObj) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid payment date" });
      }

      if (fillDate) {
        const fillDateObj = asDateOnly(fillDate);
        if (fillDateObj && paymentDateObj < fillDateObj) {
          return res.status(400).json({
            success: false,
            message: "Payment date cannot be before fill date",
          });
        }
      }

      if (paymentDateObj > todayObj) {
        return res.status(400).json({
          success: false,
          message: "Payment date cannot be in the future",
        });
      }
    }

    await db.query(
      `
      INSERT INTO vahan_submission
        (sale_id, application_number, vahan_filled_by, vahan_fill_date, payment_amount, payment_done, vahan_payment_date, rto_number, remarks)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        saleId,
        applicationNumber,
        req.user?.id || null,
        fillDate,
        paymentAmount,
        paymentDone,
        paymentDate,
        rtoNumber,
        cleanText(req.body.remarks),
      ]
    );

    await computeAndSaveStatus(saleId, req.user?.id);

    if (paymentDone === 1) {
      await db.query(
        `UPDATE vahan SET current_status = 'payment_done', last_updated_by = ?, last_updated_at = NOW() WHERE sale_id = ?`,
        [req.user?.id || null, saleId]
      );
    }

    return res.json({ success: true, message: "Vahan record created" });
  } catch (e) {
    console.error("vahan createVahan:", e);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create Vahan record" });
  }
};

// PUT /api/vahan/:sale_id/form
exports.saveForm = async (req, res) => {
  try {
    const saleId = toInt(req.params.sale_id);
    if (!saleId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid sale_id" });
    }

    const applicationNumber = cleanText(req.body.application_number);
    const fillDate = sqlDate(
      req.body.vahan_fill_date || req.body.application_filled_date
    );
    const paymentAmount = req.body.payment_amount ?? null;

    if (!applicationNumber) {
      return res
        .status(400)
        .json({ success: false, message: "application_number is required" });
    }

    if (!fillDate) {
      return res
        .status(400)
        .json({ success: false, message: "vahan_fill_date is required" });
    }

    const fillDateObj = asDateOnly(fillDate);
    const todayObj = asDateOnly(todaySqlDate());

    if (!fillDateObj) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid fill date" });
    }

    if (fillDateObj > todayObj) {
      return res
        .status(400)
        .json({ success: false, message: "Fill date cannot be in the future" });
    }

    await ensureVahanRow(saleId, req.user?.id);

    const [existing] = await db.query(
      `SELECT id FROM vahan_submission WHERE sale_id = ? ORDER BY id DESC LIMIT 1`,
      [saleId]
    );

    if (existing.length) {
      await db.query(
        `
        UPDATE vahan_submission
        SET
          application_number = ?,
          vahan_filled_by = ?,
          vahan_fill_date = ?,
          payment_amount = ?
        WHERE id = ?
        `,
        [
          applicationNumber,
          req.user?.id || null,
          fillDate,
          paymentAmount,
          existing[0].id,
        ]
      );
    } else {
      await db.query(
        `
        INSERT INTO vahan_submission
          (sale_id, application_number, vahan_filled_by, vahan_fill_date, payment_amount)
        VALUES (?, ?, ?, ?, ?)
        `,
        [saleId, applicationNumber, req.user?.id || null, fillDate, paymentAmount]
      );
    }

    await db.query(
      `
      UPDATE vahan
      SET
        current_status = 'payment_pending',
        is_completed = 0,
        last_updated_by = ?,
        last_updated_at = NOW()
      WHERE sale_id = ?
      `,
      [req.user?.id || null, saleId]
    );

    return res.json({ success: true, message: "Application saved" });
  } catch (e) {
    console.error("vahan saveForm:", e);
    return res
      .status(500)
      .json({ success: false, message: "Failed to save application" });
  }
};

// PUT /api/vahan/:sale_id/payment
exports.savePayment = async (req, res) => {
  try {
    const saleId = toInt(req.params.sale_id);
    if (!saleId) {
      return res.status(400).json({ success: false, message: "Invalid sale_id" });
    }

    const paymentDate = sqlDate(
      req.body.vahan_payment_date || req.body.payment_date
    );
    const rtoNumber = cleanText(req.body.rto_number);
    const remarks = cleanText(req.body.remarks);

    if (!paymentDate) {
      return res.status(400).json({
        success: false,
        message: "payment date is required",
      });
    }

    if (!rtoNumber) {
      return res.status(400).json({
        success: false,
        message: "rto_number is required",
      });
    }

    const sale = await getSaleById(saleId);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    const [existing] = await db.query(
      `SELECT * FROM vahan_submission WHERE sale_id = ? ORDER BY id DESC LIMIT 1`,
      [saleId]
    );

    if (!existing.length || !existing[0].application_number) {
      return res.status(400).json({
        success: false,
        message: "First save application details, then mark payment done",
      });
    }

    const fillDate = sqlDate(existing[0].vahan_fill_date);
    const fillDateObj = asDateOnly(fillDate);
    const paymentDateObj = asDateOnly(paymentDate);
    const saleDateObj = asDateOnly(sale.sale_date);
    const todayObj = asDateOnly(todaySqlDate());

    if (!paymentDateObj) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment date",
      });
    }

    if (fillDate && !fillDateObj) {
      return res.status(400).json({
        success: false,
        message: "Invalid fill date in saved application",
      });
    }

    if (!saleDateObj) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale date",
      });
    }

    if (fillDateObj && paymentDateObj < fillDateObj) {
      return res.status(400).json({
        success: false,
        message: "Payment date cannot be before fill date",
      });
    }

    if (paymentDateObj > todayObj) {
      return res.status(400).json({
        success: false,
        message: "Payment date cannot be in the future",
      });
    }

    // Business rule kept exactly:
    // Sale 1 Jan => no penalty on 1 to 7 Jan
    // Penalty starts on 8 Jan and after 8 Jan
    const penaltyStartDateObj = new Date(saleDateObj);
    penaltyStartDateObj.setDate(penaltyStartDateObj.getDate() + 7);

    const penaltyDue = paymentDateObj >= penaltyStartDateObj ? 1 : 0;

    let penaltyAmount = req.body.penalty_amount;
    if (
      penaltyAmount === "" ||
      penaltyAmount === undefined ||
      penaltyAmount === null
    ) {
      penaltyAmount = 0;
    } else {
      const n = Number(penaltyAmount);
      penaltyAmount = Number.isFinite(n) ? n : 0;
    }

    const penaltyStartDate = formatDateOnly(penaltyStartDateObj);

    await db.query(
      `
      UPDATE vahan_submission
      SET
        payment_done = 1,
        vahan_payment_date = ?,
        rto_number = ?,
        penalty_due = ?,
        penalty_amount = ?,
        remarks = ?
      WHERE id = ?
      `,
      [
        paymentDate,
        rtoNumber,
        penaltyDue,
        penaltyAmount,
        remarks,
        existing[0].id,
      ]
    );

    await db.query(
      `
      UPDATE vahan
      SET
        current_status = 'payment_done',
        is_completed = 0,
        last_updated_by = ?,
        last_updated_at = NOW()
      WHERE sale_id = ?
      `,
      [req.user?.id || null, saleId]
    );

    return res.json({
      success: true,
      message: penaltyDue
        ? "Payment saved. Penalty is applicable."
        : "Payment saved. No penalty.",
      penalty_due: penaltyDue,
      penalty_amount: penaltyAmount,
      penalty_start_date: penaltyStartDate,
    });
  } catch (e) {
    console.error("vahan savePayment:", e);
    return res.status(500).json({
      success: false,
      message: e?.sqlMessage || e?.message || "Failed to save payment",
    });
  }
};

// POST /api/vahan/:sale_id/complete
exports.completeVahan = async (req, res) => {
  try {
    const saleId = toInt(req.params.sale_id);
    if (!saleId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid sale_id" });
    }

    const [subRows] = await db.query(
      `SELECT * FROM vahan_submission WHERE sale_id = ? ORDER BY id DESC LIMIT 1`,
      [saleId]
    );

    if (!subRows.length || Number(subRows[0].payment_done || 0) !== 1) {
      return res.status(400).json({
        success: false,
        message: "Payment must be completed before marking Vahan completed",
      });
    }

    await db.query(
      `
      UPDATE vahan
      SET
        current_status = 'completed',
        is_completed = 1,
        last_updated_by = ?,
        last_updated_at = NOW()
      WHERE sale_id = ?
      `,
      [req.user?.id || null, saleId]
    );

    return res.json({ success: true, message: "Vahan marked completed" });
  } catch (e) {
    console.error("vahan completeVahan:", e);
    return res
      .status(500)
      .json({ success: false, message: "Failed to complete Vahan" });
  }
};

// PUT /api/vahan/:sale_id
exports.updateVahan = async (req, res) => {
  try {
    const saleId = toInt(req.params.sale_id);
    if (!saleId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid sale_id" });
    }

    req.body.sale_id = saleId;

    if (
      req.body.status === "done" ||
      yn(req.body.payment_done) === 1 ||
      req.body.vahan_payment_date ||
      req.body.payment_date
    ) {
      await exports.createVahan(req, res);
      return;
    }

    await exports.saveForm(req, res);
  } catch (e) {
    console.error("vahan updateVahan:", e);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update Vahan" });
  }
};

// DELETE /api/vahan/:sale_id
exports.deleteVahan = async (req, res) => {
  try {
    const saleId = toInt(req.params.sale_id);
    if (!saleId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid sale_id" });
    }

    await db.query(`DELETE FROM vahan_submission WHERE sale_id = ?`, [saleId]);
    await db.query(`DELETE FROM vahan WHERE sale_id = ?`, [saleId]);

    return res.json({ success: true, message: "Vahan deleted" });
  } catch (e) {
    console.error("vahan deleteVahan:", e);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete Vahan" });
  }
};