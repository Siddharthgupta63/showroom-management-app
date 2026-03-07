const db = require("../db");

/**
 * DASHBOARD METRICS WITH ROLE-BASED VISIBILITY
 */
exports.getDashboardMetrics = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();

    // 1) Fetch visible metrics for this role
    const [permissions] = await db.query(
      `
      SELECT metric_key
      FROM dashboard_permissions
      WHERE role = ? AND is_visible = 1
      `,
      [role]
    );

    let allowedMetrics = permissions.map((p) => p.metric_key);

    // ✅ Owner/admin fallback: show all metrics even if permissions table is empty
    if ((role === "owner" || role === "admin") && allowedMetrics.length === 0) {
      allowedMetrics = [
        "total_sales",
        "pending_insurance",
        "pending_rc",
        "pending_hsrp",
        "pending_vahan",
        "renewals_due",
      ];
    }

    if (allowedMetrics.length === 0) {
      return res.json({});
    }

    // 2) Compute all metrics
    const [
      [totalSales],
      [pendingInsurance],
      [pendingRC],
      [pendingHSRP],
      [pendingVahan],
      [renewalsDue],
    ] = await Promise.all([
      db.query(`SELECT COUNT(*) AS count FROM sales WHERE is_cancelled = 0`),

      db.query(`
        SELECT COUNT(*) AS count
        FROM sales s
        LEFT JOIN insurance i ON s.id = i.sale_id
        WHERE s.is_cancelled = 0
          AND i.id IS NULL
      `),

      db.query(`
        SELECT COUNT(*) AS count
        FROM sales s
        LEFT JOIN rc r ON s.id = r.sale_id
        WHERE s.is_cancelled = 0
          AND s.rc_required = 1
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
        WHERE s.is_cancelled = 0
          AND vs.id IS NULL
      `),

      db.query(`
        SELECT COUNT(*) AS count
        FROM renewals
        WHERE renewal_date IS NULL
      `),
    ]);

    const metricMap = {
      total_sales: Number(totalSales?.[0]?.count || 0),
      pending_insurance: Number(pendingInsurance?.[0]?.count || 0),
      pending_rc: Number(pendingRC?.[0]?.count || 0),
      pending_hsrp: Number(pendingHSRP?.[0]?.count || 0),
      pending_vahan: Number(pendingVahan?.[0]?.count || 0),
      renewals_due: Number(renewalsDue?.[0]?.count || 0),
    };

    const response = {};
    for (const key of allowedMetrics) {
      response[key] = metricMap[key] ?? 0;
    }

    return res.json(response);
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ message: "Dashboard failed" });
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
