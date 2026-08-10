// UC-001: Routes for roster sync.

const express = require("express");
const rosterController = require("../controllers/rosterController");

const router = express.Router();

router.get("/health", rosterController.getSourceHealth);
router.post("/sync", rosterController.importNow);
router.get("/sync/summary", rosterController.getSyncSummary);
router.get("/sync/history", rosterController.getSyncHistory);
router.get("/exceptions/resolved", rosterController.getResolvedExceptions);
router.post("/exceptions/:timesheetRowId/resolve", rosterController.resolveException);
router.post("/exceptions/:timesheetRowId/undo", rosterController.undoException);
router.post("/exceptions/reset", rosterController.resetPeriodResolutions);

module.exports = router;
