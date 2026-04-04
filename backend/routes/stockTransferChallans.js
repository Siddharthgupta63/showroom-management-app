const express = require("express");
const router = express.Router();

const controller = require("../controllers/stockTransferChallansController");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/", controller.listChallans);
router.get("/next-number", controller.getNextChallanNumber);
router.get("/export-items", controller.exportChallanItems);
router.get("/:id", controller.getChallanById);

router.post(
  "/",
  requireRole(["owner", "admin", "manager"]),
  controller.createChallan
);

router.post(
  "/:id/items",
  requireRole(["owner", "admin", "manager"]),
  controller.addChallanItem
);

router.delete(
  "/:id/items/:itemId",
  requireRole(["owner", "admin", "manager"]),
  controller.removeChallanItem
);

router.post(
  "/:id/post",
  requireRole(["owner", "admin", "manager"]),
  controller.postChallan
);

router.post(
  "/:id/cancel",
  requireRole(["owner", "admin", "manager"]),
  controller.cancelChallan
);

module.exports = router;