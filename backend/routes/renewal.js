// backend/routes/renewal.js

const express = require('express');
const router = express.Router();

const renewalController = require('../controllers/renewalController');
const {
  authMiddleware,
  requireRole,
} = require('../middleware/authMiddleware');

// --------------------------------------------------
// CREATE renewal for a sale
// POST /api/renewal/:sale_id
// Allowed: owner, manager, renewal, sales
// --------------------------------------------------
router.post(
  '/:sale_id',
  authMiddleware,
  requireRole('owner', 'manager', 'renewal', 'sales'),
  renewalController.createRenewal
);

// --------------------------------------------------
// GET renewal for a sale
// GET /api/renewal/:sale_id
// --------------------------------------------------
router.get(
  '/:sale_id',
  authMiddleware,
  requireRole('owner', 'manager', 'renewal', 'sales'),
  renewalController.getRenewal
);

// --------------------------------------------------
// UPDATE renewal for a sale
// PUT /api/renewal/:sale_id
// --------------------------------------------------
router.put(
  '/:sale_id',
  authMiddleware,
  requireRole('owner', 'manager', 'renewal', 'sales'),
  renewalController.updateRenewal
);

// --------------------------------------------------
// DELETE renewal for a sale
// DELETE /api/renewal/:sale_id
// --------------------------------------------------
router.delete(
  '/:sale_id',
  authMiddleware,
  requireRole('owner', 'manager', 'renewal'),
  renewalController.deleteRenewal
);

module.exports = router;
