// UC-001: Routes for roster sync.

const express = require("express");
const rosterController = require("../controllers/rosterController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validateRequest = require("../middleware/validateRequest");
const validator = require("../validators/rosterValidator");

const router = express.Router();

router.get("/health", rosterController.getSourceHealth);
router.use(authenticate, authorize("manager"));
router.post("/sync", validateRequest(validator.payPeriodBodySchema), rosterController.importNow);
router.get("/sync/summary", validateRequest(validator.payPeriodQuerySchema, "query"), rosterController.getSyncSummary);
router.get("/sync/history", validateRequest(validator.payPeriodQuerySchema, "query"), rosterController.getSyncHistory);
router.get("/exceptions/resolved", validateRequest(validator.payPeriodQuerySchema, "query"), rosterController.getResolvedExceptions);
router.post("/exceptions/:timesheetRowId/resolve", validateRequest(validator.timesheetRowParamsSchema, "params"), rosterController.resolveException);
router.post("/exceptions/:timesheetRowId/undo", validateRequest(validator.timesheetRowParamsSchema, "params"), rosterController.undoException);
router.post("/exceptions/reset", validateRequest(validator.payPeriodBodySchema), rosterController.resetPeriodResolutions);

module.exports = router;
