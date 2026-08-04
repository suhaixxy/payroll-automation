const express = require("express");
const router = express.Router();

router.use("/roster", require("./roster"));
router.use("/timesheets", require("./timesheets"));
router.use("/payroll", require("./payroll"));
router.use("/approvals", require("./approvals"));
router.use("/payments", require("./payments"));
router.use("/staff", require("./staff"));
router.use("/pay-periods", require("./payPeriods"));
// UC-005 authentication
router.use("/auth", require("./auth"));

module.exports = router;