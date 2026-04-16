const db = require("../db");

async function getTableColumns(tableName) {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((r) => String(r.Field || "").toLowerCase()));
}

function firstExisting(columns, candidates) {
  for (const c of candidates) {
    if (columns.has(String(c).toLowerCase())) return c;
  }
  return null;
}

exports.getDashboard = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();

    if (!role) {
      return res.json({
        data: {},
        message: "No role found",
      });
    }

    if (role !== "owner" && role !== "admin") {
      return res.json({
        data: {},
        message: "No dashboard metrics available for this role",
      });
    }

    const vahanSubmissionCols = await getTableColumns("vahan_submission");
    const hsrpCols = await getTableColumns("hsrp");
    const rcCols = await getTableColumns("rc");
    const insuranceCols = await getTableColumns("insurance");

    const vahanPaymentCol = firstExisting(vahanSubmissionCols, [
      "payment_date",
      "vahan_payment_date",
      "paid_date",
      "payment_done_date",
    ]);

    const vahanFilledCol = firstExisting(vahanSubmissionCols, [
      "vahan_filled_date",
      "vahan_fill_date",
      "filled_date",
      "submission_date",
      "vahan_filled_at",
    ]);

    const hsrpNumberCol = firstExisting(hsrpCols, [
      "hsrp_number",
      "registration_number",
      "order_number",
    ]);

    const rcNumberCol = firstExisting(rcCols, [
      "rc_number",
      "registration_number",
    ]);

    const insuranceIdCol = insuranceCols.has("id") ? "id" : null;
    const insuranceExpiryCol = firstExisting(insuranceCols, [
      "expiry_date",
      "policy_expiry_date",
    ]);

    const [[sales]] = await db.query(`
      SELECT COUNT(*) AS total_sales
      FROM sales
    `);

    const [[stock]] = await db.query(`
      SELECT COUNT(*) AS total_stock
      FROM vehicle_purchase_items
      WHERE status_code = 'in_stock'
    `);

    const [[pendingInsurance]] = insuranceIdCol
      ? await db.query(`
          SELECT COUNT(*) AS pending_insurance
          FROM sales s
          LEFT JOIN insurance i ON i.sale_id = s.id
          WHERE i.${insuranceIdCol} IS NULL
        `)
      : [[{ pending_insurance: 0 }]];

    const [[pendingRc]] = rcNumberCol
      ? await db.query(`
          SELECT COUNT(*) AS pending_rc
          FROM vahan v
          LEFT JOIN rc r ON r.sale_id = v.sale_id
          WHERE COALESCE(v.rc_required, 0) = 1
            AND (
              r.id IS NULL
              OR r.${rcNumberCol} IS NULL
              OR r.${rcNumberCol} = ''
            )
        `)
      : [[{ pending_rc: 0 }]];

    const [[pendingHsrp]] = hsrpNumberCol
      ? await db.query(`
          SELECT COUNT(*) AS pending_hsrp
          FROM sales s
          LEFT JOIN hsrp h ON h.sale_id = s.id
          WHERE h.id IS NULL
             OR h.${hsrpNumberCol} IS NULL
             OR h.${hsrpNumberCol} = ''
        `)
      : [[{ pending_hsrp: 0 }]];

    const [[pendingVahanFill]] = vahanFilledCol
      ? await db.query(`
          SELECT COUNT(*) AS pending_vahan_fill
          FROM sales s
          LEFT JOIN vahan_submission vs ON vs.sale_id = s.id
          WHERE vs.id IS NULL
             OR vs.${vahanFilledCol} IS NULL
        `)
      : await db.query(`
          SELECT COUNT(*) AS pending_vahan_fill
          FROM sales s
          LEFT JOIN vahan_submission vs ON vs.sale_id = s.id
          WHERE vs.id IS NULL
        `);

    const [[pendingVahanPayment]] = vahanPaymentCol
      ? await db.query(`
          SELECT COUNT(*) AS pending_vahan_payment
          FROM vahan_submission vs
          WHERE vs.${vahanPaymentCol} IS NULL
        `)
      : [[{ pending_vahan_payment: 0 }]];

    const [[renewalsDue]] = insuranceExpiryCol
      ? await db.query(`
          SELECT COUNT(*) AS renewals_due
          FROM insurance
          WHERE ${insuranceExpiryCol} IS NOT NULL
            AND ${insuranceExpiryCol} <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        `)
      : [[{ renewals_due: 0 }]];

    return res.json({
      data: {
        total_sales: Number(sales?.total_sales || 0),
        total_stock: Number(stock?.total_stock || 0),
        pending_insurance: Number(pendingInsurance?.pending_insurance || 0),
        pending_rc: Number(pendingRc?.pending_rc || 0),
        pending_hsrp: Number(pendingHsrp?.pending_hsrp || 0),
        pending_vahan_fill: Number(pendingVahanFill?.pending_vahan_fill || 0),
        pending_vahan_payment: Number(
          pendingVahanPayment?.pending_vahan_payment || 0
        ),
        renewals_due: Number(renewalsDue?.renewals_due || 0),
      },
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({
      message: "Dashboard failed",
      error: err.message,
    });
  }
};