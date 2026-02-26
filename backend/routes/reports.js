// backend/routes/reports.js

const express = require('express');
const router = express.Router();

const reportsController = require('../controllers/reportsController');
const { authMiddleware } = require('../middleware/authMiddleware');

/**
 * DASHBOARD REPORT
 * GET /api/reports/dashboard
 */
router.get(
  '/dashboard',
  authMiddleware,
  reportsController.getDashboardMetrics
);

/**
 * SALES SUMMARY
 * GET /api/reports/sales-summary
 */
router.get(
  '/sales-summary',
  authMiddleware,
  reportsController.getSalesSummary
);

/**
 * DAILY REPORT
 * GET /api/reports/daily
 */
router.get(
  '/daily',
  authMiddleware,
  reportsController.getDailyReport
);

/**
 * MONTHLY REPORT
 * GET /api/reports/monthly
 */
router.get(
  '/monthly',
  authMiddleware,
  reportsController.getMonthlyReport
);

/**
 * INCENTIVE REPORT
 * GET /api/reports/incentive
 */
router.get(
  '/incentive',
  authMiddleware,
  reportsController.getIncentiveReport
);

module.exports = router;
