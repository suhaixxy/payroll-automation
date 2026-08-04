const express = require("express");
const staffController = require("../controllers/staffController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validateRequest = require("../middleware/validateRequest");
const { staffParamsSchema, bankDetailsSchema } = require("../validators/paymentValidator");

const router = express.Router();
router.patch("/:staffId/bank-details", authenticate, authorize("manager"), validateRequest(staffParamsSchema, "params"), validateRequest(bankDetailsSchema), staffController.updateBankDetails);

module.exports = router;
