const express = require("express");
const router = express.Router();

const {
  getPurchaseVsSales,
} = require("../controllers/reportsPurchaseVsSalesController");

router.get("/purchase-vs-sales", getPurchaseVsSales);

module.exports = router;