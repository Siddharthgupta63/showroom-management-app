const express = require("express");
const router = express.Router();

const controller = require("../controllers/stockTransfersController");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/", controller.listTransfers);
router.get("/:stockItemId/history", controller.getTransferHistory);

router.post(
  "/",
  requireRole(["owner", "admin", "manager"]),
  controller.createTransfer
);

module.exports = router;