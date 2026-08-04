const express = require("express");
const payslipController = require("../controllers/payslipController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validateRequest = require("../middleware/validateRequest");
const validator = require("../validators/payslipValidator");

const router = express.Router();
router.use(authenticate);
router.get("/me", payslipController.listMine);
router.get("/", authorize("manager"), payslipController.listAll);
router.get("/:payslipId", validateRequest(validator.payslipParamsSchema, "params"), payslipController.getById);
router.get("/:payslipId/pdf", validateRequest(validator.payslipParamsSchema, "params"), payslipController.download);

module.exports = router;
