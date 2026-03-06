// routes/hsrp.js

const express = require('express');
const router = express.Router();

const hsrpController = require('../controllers/hsrpController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// All /api/hsrp routes require a valid JWT
router.use(authMiddleware);

// Example routes (adapt names to match hsrpController exports)

// GET /api/hsrp
router.get(
  '/',
  requireRole('owner', 'manager', 'hsrp'),
  hsrpController.getHSRPRequests
);

// POST /api/hsrp
router.post(
  '/',
  requireRole('owner', 'manager', 'hsrp'),
  hsrpController.createHSRPRequest
);

// PUT /api/hsrp/:id
router.put(
  '/:id',
  requireRole('owner', 'manager', 'hsrp'),
  hsrpController.updateHSRPRequest
);

// DELETE /api/hsrp/:id
router.delete(
  '/:id',
  requireRole('owner'),
  hsrpController.deleteHSRPRequest
);

module.exports = router;
