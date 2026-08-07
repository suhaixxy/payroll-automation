const express = require("express");
const paymentController = require("../controllers/paymentController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validateRequest = require("../middleware/validateRequest");
const validator = require("../validators/paymentValidator");
const payslipController = require("../controllers/payslipController");

const router = express.Router();
router.use(authenticate, authorize("manager"));

router.get("/eligible-periods", paymentController.eligiblePeriods);
router.get("/preview", validateRequest(validator.previewSchema, "query"), paymentController.preview);
router.get("/dashboard/statistics", paymentController.statistics);
router.post("/generate", validateRequest(validator.generateSchema), paymentController.generate);
router.get("/", validateRequest(validator.listSchema, "query"), paymentController.list);
router.get("/:batchId", validateRequest(validator.batchParamsSchema, "params"), paymentController.getById);
router.get("/:batchId/file", validateRequest(validator.batchParamsSchema, "params"), paymentController.download);
router.get("/:batchId/payslips", validateRequest(validator.batchParamsSchema, "params"), payslipController.listForBatch);
router.post("/:batchId/retry-hrms", validateRequest(validator.batchParamsSchema, "params"), paymentController.retryHrms);
router.patch("/:batchId/cancel", validateRequest(validator.batchParamsSchema, "params"), validateRequest(validator.cancelSchema), paymentController.cancel);

module.exports = router;
