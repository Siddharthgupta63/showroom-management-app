const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/authMiddleware");
const c = require("../controllers/stockController");

router.use(authMiddleware);

// Full stock page data
router.get("/", c.getAllStock);

// Only available stock rows
router.get("/available", c.getAvailableStock);

module.exports = router;