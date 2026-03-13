const express = require("express");
const router = express.Router();

const { authMiddleware, requirePermission } = require("../middleware/authMiddleware");
const pipelineController = require("../controllers/pipelineController");

router.get("/", authMiddleware, pipelineController.listPipeline);

// KPIs: owner/admin allowed automatically by middleware logic, others need permission
router.get(
  "/kpis",
  authMiddleware,
  requirePermission("pipeline_open_sale"),
  pipelineController.pipelineKpis
);

// Export CSV: requires pipeline_export permission (or owner/admin)
router.get(
  "/export",
  authMiddleware,
  requirePermission("pipeline_export"),
  pipelineController.exportPipelineCsv
);

module.exports = router;