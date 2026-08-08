// UC-001: Routes for roster sync.

const express = require("express");
const rosterController = require("../controllers/rosterController");

const router = express.Router();

router.post("/sync", rosterController.importNow);
router.get("/sync/summary", rosterController.getSyncSummary);
router.get("/sync/history", rosterController.getSyncHistory);
router.patch("/exceptions/:timesheetRowId/resolve", rosterController.resolveException);

module.exports = router;
