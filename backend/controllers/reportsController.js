const db = require("../db");

/**
 * DASHBOARD METRICS WITH ROLE-BASED VISIBILITY
 */
exports.getDashboardMetrics = async (req, res) => {
  try {
    const { role } = req.user; // from authMiddleware

    // 1️⃣ Fetch visible metrics for this role
    const [permissions] = await db.query(
      `
      SELECT metric_key
      FROM dashboard_permissions
      WHERE role = ? AND is_visible = 1
      `,
      [role]
    );

    const allowedMetrics = permissions.map(p => p.metric_key);

    if (allowedMetrics.length === 0) {
      return res.json({});
    }

    // 2️⃣ Compute ALL metrics (safe, backend only)
    const [
      [totalSales],
      [pendingInsurance],
      [pendingRC],
      [pendingHSRP],
      [pendingVahan],
      [renewalsDue],
    ] = await Promise.all([
      db.query(`SELECT COUNT(*) AS count FROM sales`),

      db.query(`
        SELECT COUNT(*) AS count
        FROM sales s
        LEFT JOIN insurance i ON s.id = i.sale_id
        WHERE i.id IS NULL
      `),

      db.query(`
        SELECT COUNT(*) AS count
        FROM sales s
        LEFT JOIN rc r ON s.id = r.sale_id
        WHERE s.rc_required = 1
        AND r.id IS NULL
      `),

      db.query(`
        SELECT COUNT(*) AS count
        FROM hsrp
        WHERE hsrp_required = 1
        AND (hsrp_number IS NULL OR hsrp_number = '')
      `),

      db.query(`
        SELECT COUNT(*) AS count
        FROM sales s
        LEFT JOIN vahan_submission vs ON s.id = vs.sale_id
        WHERE vs.id IS NULL
      `),

      db.query(`
        SELECT COUNT(*) AS count
        FROM renewals
        WHERE renewal_date IS NULL
      `),
    ]);

    // 3️⃣ Metric map
    const metricMap = {
      total_sales: totalSales[0].count,
      pending_insurance: pendingInsurance[0].count,
      pending_rc: pendingRC[0].count,
      pending_hsrp: pendingHSRP[0].count,
      pending_vahan: pendingVahan[0].count,
      renewals_due: renewalsDue[0].count,
    };

    // 4️⃣ Filter response by permissions
    const response = {};
    for (const key of allowedMetrics) {
      response[key] = metricMap[key] ?? 0;
    }

    res.json(response);
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Dashboard failed" });
  }
};

const reportsService = require('../services/reportsService');

exports.getSalesSummary = async (req, res) => {
  const data = await reportsService.getSalesSummary();
  res.json(data);
};

exports.getDailyReport = async (req, res) => {
  const data = await reportsService.getTodayReport();
  res.json(data);
};

exports.getMonthlyReport = async (req, res) => {
  const data = await reportsService.getMonthlyTrend();
  res.json(data);
};

exports.getIncentiveReport = async (req, res) => {
  const data = await reportsService.getIncentiveReport(
    req.query.startDate,
    req.query.endDate
  );
  res.json(data);
};
