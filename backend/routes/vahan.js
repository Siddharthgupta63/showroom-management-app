// backend/routes/vahan.js

const express = require('express');
const router = express.Router();

const vahanController = require('../controllers/vahanController');
const {
  authMiddleware,
  requireRole,
} = require('../middleware/authMiddleware');

// --------------------------------------------------
// CREATE Vahan details for a sale
// POST /api/vahan/:sale_id
// --------------------------------------------------
router.post(
  '/:sale_id',
  authMiddleware,
  requireRole('owner', 'manager', 'vahan', 'sales'),
  vahanController.createVahan
);

// --------------------------------------------------
// GET Vahan details for a sale
// GET /api/vahan/:sale_id
// --------------------------------------------------
router.get(
  '/:sale_id',
  authMiddleware,
  requireRole('owner', 'manager', 'vahan', 'sales'),
  vahanController.getVahan
);

// --------------------------------------------------
// UPDATE Vahan details for a sale
// PUT /api/vahan/:sale_id
// --------------------------------------------------
router.put(
  '/:sale_id',
  authMiddleware,
  requireRole('owner', 'manager', 'vahan', 'sales'),
  vahanController.updateVahan
);

// --------------------------------------------------
// DELETE Vahan record for a sale
// DELETE /api/vahan/:sale_id
// --------------------------------------------------
router.delete(
  '/:sale_id',
  authMiddleware,
  requireRole('owner', 'manager', 'vahan'),
  vahanController.deleteVahan
);

module.exports = router;
