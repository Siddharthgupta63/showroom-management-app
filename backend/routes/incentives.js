// backend/routes/incentives.js

const express = require('express');
const router = express.Router();

const incentivesController = require('../controllers/incentivesController');
const {
  authMiddleware,
  requireRole,
} = require('../middleware/authMiddleware');

// --------------------------------------------------
// CREATE incentive
// POST /api/incentives
// --------------------------------------------------
router.post(
  '/',
  authMiddleware,
  requireRole('owner', 'manager'),
  incentivesController.createIncentive
);

// --------------------------------------------------
// GET all incentives (with filters if your controller supports them)
// GET /api/incentives
// --------------------------------------------------
router.get(
  '/',
  authMiddleware,
  requireRole('owner', 'manager'),
  incentivesController.getIncentives
);

// --------------------------------------------------
// UPDATE incentive
// PUT /api/incentives/:id
// --------------------------------------------------
router.put(
  '/:id',
  authMiddleware,
  requireRole('owner', 'manager'),
  incentivesController.updateIncentive
);

// --------------------------------------------------
// DELETE incentive
// DELETE /api/incentives/:id
// --------------------------------------------------
router.delete(
  '/:id',
  authMiddleware,
  requireRole('owner', 'manager'),
  incentivesController.deleteIncentive
);

module.exports = router;
