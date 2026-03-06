// backend/services/reportsService.js

const db = require("../db");

/**
 * Utility: run a query and return rows safely
 */
async function q(query, params = []) {
  const [rows] = await pool.query(query, params);
  return rows;
}

async function getDashboardMetrics(userId) {
  return getDashboard();
}

/**
 * =========================
 * DASHBOARD
 * =========================
 */
async function getDashboard() {
  const salesCountRes = await q(
    `SELECT COUNT(*) AS total_sales FROM sales`
  );

  const totalSalesRes = await q(
    `SELECT IFNULL(SUM(sale_price),0) AS total_sale_value FROM sales`
  );

  const incentivesRes = await q(
    `SELECT IFNULL(SUM(total_incentive),0) AS total_incentives FROM incentives`
  );

  return {
    totalSales: Number(salesCountRes[0]?.total_sales || 0),
    totalSaleValue: Number(totalSalesRes[0]?.total_sale_value || 0),
    totalIncentives: Number(incentivesRes[0]?.total_incentives || 0),
  };
}

/**
 * =========================
 * SALES SUMMARY
 * =========================
 */
async function getSalesSummary() {
  return q(`
    SELECT id, customer_name, invoice_number, sale_price, sale_date, created_at
    FROM sales
    ORDER BY sale_date DESC
    LIMIT 200
  `);
}

/**
 * =========================
 * MONTHLY TREND
 * =========================
 */
async function getMonthlyTrend() {
  return q(`
    SELECT DATE_FORMAT(sale_date,'%Y-%m') AS month,
           IFNULL(SUM(sale_price),0) AS total
    FROM sales
    WHERE sale_date IS NOT NULL
    GROUP BY DATE_FORMAT(sale_date,'%Y-%m')
    ORDER BY month DESC
    LIMIT 12
  `);
}

/**
 * =========================
 * TODAY REPORT
 * =========================
 */
async function getTodayReport() {
  return q(`
    SELECT id, customer_name, invoice_number, sale_price, sale_date
    FROM sales
    WHERE DATE(sale_date) = CURDATE()
    ORDER BY id DESC
  `);
}

/**
 * =========================
 * MONTHLY SUMMARY
 * =========================
 */
async function getMonthlySummary(startDate, endDate) {
  if (!startDate || !endDate) {
    startDate = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    endDate = new Date().toISOString().slice(0, 10);
  }

  return q(
    `
    SELECT id, customer_name, invoice_number, sale_price, sale_date
    FROM sales
    WHERE sale_date BETWEEN ? AND ?
    ORDER BY sale_date
    `,
    [startDate, endDate]
  );
}

/**
 * =========================
 * PENDING WORK
 * =========================
 */
async function getPendingWork() {
  return q(`
    SELECT id, customer_name, invoice_number, sale_price, process_completed
    FROM sales
    WHERE process_completed = 0 OR process_completed IS NULL
    ORDER BY sale_date DESC
  `);
}

/**
 * =========================
 * INCENTIVE REPORT
 * =========================
 */
async function getIncentiveReport(startDate, endDate) {
  if (!startDate || !endDate) {
    startDate = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    endDate = new Date().toISOString().slice(0, 10);
  }

  return q(
    `
    SELECT i.*, s.invoice_number, s.customer_name, s.sale_price
    FROM incentives i
    LEFT JOIN sales s ON s.id = i.sale_id
    WHERE DATE(i.created_at) BETWEEN ? AND ?
    ORDER BY i.created_at DESC
    `,
    [startDate, endDate]
  );
}

/**
 * =========================
 * MAIN ROUTER FUNCTION
 * (USED BY CONTROLLER)
 * =========================
 */
async function getReportByType(type, startDate, endDate) {
  switch (type) {
    case 'dashboard':
      return getDashboard();

    case 'sales-summary':
      return getSalesSummary();

    case 'monthly-trend':
      return getMonthlyTrend();

    case 'today':
      return getTodayReport();

    case 'monthly-summary':
      return getMonthlySummary(startDate, endDate);

    case 'pending':
      return getPendingWork();

    case 'incentive':
      return getIncentiveReport(startDate, endDate);

    default:
      throw new Error('Invalid report type');
  }
}

module.exports = {
  getDashboard,
  getSalesSummary,
  getMonthlyTrend,
  getTodayReport,
  getMonthlySummary,
  getPendingWork,
  getIncentiveReport,
  getReportByType, // ✅ REQUIRED
};
