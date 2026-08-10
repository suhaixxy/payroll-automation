const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validateRequest = require("../middleware/validateRequest");
const timesheetController = require("../controllers/timesheetController");
const validator = require("../validators/timesheetValidator");

const router = express.Router();

router.use(authenticate, authorize("manager"));

router.get("/periods", timesheetController.listPeriods);
router.patch(
  "/exceptions/:exceptionId",
  validateRequest(validator.exceptionParamsSchema, "params"),
  validateRequest(validator.resolveSchema),
  timesheetController.resolveException
);
router.get(
  "/:payPeriodId/review",
  validateRequest(validator.payPeriodParamsSchema, "params"),
  timesheetController.review
);
router.get(
  "/:payPeriodId/audit-log",
  validateRequest(validator.payPeriodParamsSchema, "params"),
  timesheetController.auditLog
);
router.post(
  "/:payPeriodId/validate",
  validateRequest(validator.payPeriodParamsSchema, "params"),
  timesheetController.runValidation
);
router.patch(
  "/:payPeriodId/exceptions/bulk",
  validateRequest(validator.payPeriodParamsSchema, "params"),
  validateRequest(validator.bulkResolveSchema),
  timesheetController.bulkResolve
);
router.post(
  "/:payPeriodId/complete",
  validateRequest(validator.payPeriodParamsSchema, "params"),
  timesheetController.completeValidation
);

module.exports = router;
