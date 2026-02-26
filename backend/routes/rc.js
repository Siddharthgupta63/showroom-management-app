// routes/rc.js

const express = require('express');
const router = express.Router();

const rcController = require('../controllers/rcController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// All /api/rc routes require authentication
router.use(authMiddleware);

// GET /api/rc  (owner / manager / rc)
router.get(
  '/',
  requireRole('owner', 'manager', 'rc'),
  rcController.getRCs
);

// POST /api/rc  (owner / manager / rc)
router.post(
  '/',
  requireRole('owner', 'manager', 'rc'),
  rcController.createRC
);

// PUT /api/rc/:id  (owner / manager / rc)
router.put(
  '/:id',
  requireRole('owner', 'manager', 'rc'),
  rcController.updateRC
);

// DELETE /api/rc/:id  (owner)
router.delete(
  '/:id',
  requireRole('owner'),
  rcController.deleteRC
);

module.exports = router;
