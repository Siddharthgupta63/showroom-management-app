const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/authMiddleware");
const c = require("../controllers/stockController");

router.use(authMiddleware);

router.get("/", c.getAllStock);
router.get("/available", c.getAvailableStock);

module.exports = router;